import type { User } from "firebase/auth";
import {
  getExpenseStatementGroupForUser,
  getWebExpenseStatementSource,
} from "../data/webExpenseStatementRepository";

export type { ExpenseStatementMonth } from "../data/expenseStatementRepository";

export async function getExpenseStatementData(user: User, signal?: AbortSignal) {
  const groupId = await getExpenseStatementGroupForUser(user);
  if (signal?.aborted) return null;
  const source = await getWebExpenseStatementSource(groupId, signal);
  if (!source) return null;

  if (source.transactions.some(transaction => !Number.isFinite(transaction.value))) {
    throw new Error("Há lançamentos com valores inválidos. Corrija-os no extrato antes de consultar os totais.");
  }

  return source;
}
