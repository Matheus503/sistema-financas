import { isCreditCardAccount } from "../../../domain/finance/account";
import type { FinanceAccount } from "../../../domain/finance/account";
import type { FinanceMonth } from "../../../domain/finance/month";
import type { FinanceTransaction } from "../../../domain/finance/transaction";

export type CardStatementTransaction = FinanceTransaction & {
  transactionType?: string;
};

export type CardStatementItem = {
  id: string;
  transactionId: string;
  monthId: string;
  accountId?: string;
  accountName?: string;
  date: string;
  value: number;
  monthLabel: string;
  monthOrder: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  transactionType?: string;
};

const formatMonthLabel = (month: number, year: number) =>
  `Fatura ${String(month).padStart(2, "0")}/${year}`;

export function buildCardStatementItems(
  month: FinanceMonth,
  accounts: FinanceAccount[],
  transactions: CardStatementTransaction[],
): CardStatementItem[] {
  const creditCardAccounts = accounts.filter(isCreditCardAccount);
  const creditCardById = new Map(
    creditCardAccounts.map((account) => [String(account.id), account]),
  );
  const creditCardIds = new Set(creditCardAccounts.map((account) => String(account.id)));
  const monthLabel = formatMonthLabel(month.month, month.year);
  const monthOrder = month.year * 100 + month.month;

  const items: CardStatementItem[] = [];

  for (const transaction of transactions || []) {
    if (!transaction || !transaction.accountId) continue;
    if (!creditCardIds.has(String(transaction.accountId))) continue;

    const account = creditCardById.get(String(transaction.accountId));
    items.push({
      id: `${month.id}-${transaction.id || Math.random()}`,
      transactionId: String(transaction.id),
      monthId: month.id,
      accountId: String(transaction.accountId),
      accountName: account?.name || "",
      date: transaction.date ? String(transaction.date) : "",
      value: Number(transaction.value ?? 0),
      monthLabel,
      monthOrder,
      note: transaction.note ? String(transaction.note) : "",
      category: transaction.category ? String(transaction.category) : "",
      userId: transaction.userId ? String(transaction.userId) : "",
      userName: transaction.userName ? String(transaction.userName) : "",
      launcherId: transaction.launcherId ? String(transaction.launcherId) : "",
      launcherName: transaction.launcherName ? String(transaction.launcherName) : "",
      installmentGroupId: transaction.installmentGroupId
        ? String(transaction.installmentGroupId)
        : "",
      installmentCurrent: transaction.installmentCurrent
        ? Number(transaction.installmentCurrent)
        : undefined,
      installmentTotal: transaction.installmentTotal
        ? Number(transaction.installmentTotal)
        : undefined,
      transactionType: transaction.transactionType
        ? String(transaction.transactionType)
        : "",
    });
  }

  items.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return b.monthOrder - a.monthOrder;
  });

  return items;
}
