import { getAllMonths } from "./monthService";
import { getAccountsByMonth, isCreditCardAccount, type FinanceAccount } from "./accountService";
import { getTransactions } from "./transactionService";
import type { SettledAccount } from "../lib/monthlyReport";

export async function getMonthlyReportData(groupId: string) {
  const docs = await getAllMonths(groupId);
  const months = docs.map(m => ({ id: m.id, year: Number(m.year), month: Number(m.month) }))
    .filter(m => Number.isInteger(m.year) && m.year >= 1900 && Number.isInteger(m.month) && m.month >= 1 && m.month <= 12);
  const accounts: SettledAccount[] = [];
  // Read every source month: a January bill may have been paid in another year.
  // Batches bound concurrent Firestore reads for long histories.
  for (let start = 0; start < months.length; start += 6) {
    const batch = await Promise.all(months.slice(start, start + 6).map(async month => {
      const source = await getAccountsByMonth(month.id) as FinanceAccount[];
      const settled = source.filter(a => a.isPaid && ["CREDIT", "FIXED", "VARIABLE"].includes(a.type));
      const transactions = settled.some(isCreditCardAccount) ? await getTransactions(month.id) : [];
      const cardTotals = new Map<string, number>();
      for (const t of transactions as { accountId?: string; value?: number }[]) {
        if (t.accountId && Number.isFinite(Number(t.value))) cardTotals.set(t.accountId, (cardTotals.get(t.accountId) || 0) + Math.round(Number(t.value) * 100));
      }
      return settled.map(account => ({
        monthId: month.id, accountId: account.id, name: account.name,
        type: account.type as SettledAccount["type"],
        value: (Math.round(Number(account.value || 0) * 100) + (isCreditCardAccount(account) ? cardTotals.get(account.id) || 0 : 0)) / 100,
        sourceYear: month.year, sourceMonth: month.month, paidOn: account.paidOn,
      }));
    }));
    accounts.push(...batch.flat());
  }
  if (accounts.some(a => !Number.isFinite(a.value))) throw new Error("Há contas com valores inválidos. Corrija-as antes de consultar o relatório.");
  return { accounts, months };
}
