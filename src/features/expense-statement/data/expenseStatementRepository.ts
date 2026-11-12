import type { Firestore } from "firebase/firestore";
import type { FinanceAccount } from "../../../domain/finance/account";
import type { FinanceTransaction } from "../../../domain/finance/transaction";
import type { StatementTransaction } from "../../../domain/finance/expenseStatement";
import { getAccountsByMonth } from "../../accounts/data/accountService";
import { getAllMonths } from "../../months/data/monthService";
import { getTransactions, linkUnclassifiedTransaction } from "../../transactions/data/transactionService";
import { getGroupMembers } from "../../members/data/userService";

export type ExpenseStatementMonth = { id: string; year: number; month: number };
type RawTransaction = FinanceTransaction;

export async function getAccountsForUnclassifiedEntries(monthIds: string[], firestore: Firestore) {
  const entries = await Promise.all(monthIds.map(async (monthId) => [
    monthId,
    await getAccountsByMonth(monthId, firestore),
  ] as const));
  return Object.fromEntries(entries) as Record<string, FinanceAccount[]>;
}

export function linkExpenseStatementEntry(monthId: string, transactionId: string, accountId: string, firestore: Firestore) {
  return linkUnclassifiedTransaction(monthId, transactionId, accountId, firestore);
}

export async function getExpenseStatementSource(groupId: string, firestore: Firestore, signal?: AbortSignal) {
  const [documents, members] = await Promise.all([
    getAllMonths(groupId, firestore),
    getGroupMembers(groupId, firestore),
  ]);
  const months = documents.map(month => ({
    id: month.id,
    year: Number(month.year),
    month: Number(month.month),
  }));
  const transactions: StatementTransaction[] = [];

  for (let offset = 0; offset < months.length; offset += 6) {
    if (signal?.aborted) return null;
    const batch = await Promise.all(months.slice(offset, offset + 6).map(async month => {
      const [entries, accounts] = await Promise.all([
        getTransactions(month.id, firestore),
        getAccountsByMonth(month.id, firestore),
      ]);
      const types = new Map(accounts.map(account => [account.id, account.type]));
      return (entries as RawTransaction[]).map(transaction => ({
        ...transaction,
        value: Number(transaction.value),
        monthId: month.id,
        year: month.year,
        month: month.month,
        accountType: types.get(transaction.accountId || ""),
      }));
    }));
    if (signal?.aborted) return null;
    transactions.push(...batch.flat());
  }

  return { months, members, transactions };
}
