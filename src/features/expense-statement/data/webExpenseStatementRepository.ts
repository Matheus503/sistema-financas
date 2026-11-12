import type { User } from "firebase/auth";
import { db } from "../../../lib/firestore";
import { ensureWebUserProfile } from "../../auth/data/webUserProfileRepository";
import {
  getAccountsForUnclassifiedEntries,
  getExpenseStatementSource,
  linkExpenseStatementEntry,
} from "./expenseStatementRepository";

export async function getExpenseStatementGroupForUser(user: User) {
  const profile = await ensureWebUserProfile(user);
  return profile.groupId;
}

export const getWebExpenseStatementSource = (groupId: string, signal?: AbortSignal) =>
  getExpenseStatementSource(groupId, db, signal);

export const getWebAccountsForUnclassifiedEntries = (monthIds: string[]) =>
  getAccountsForUnclassifiedEntries(monthIds, db);

export const linkWebExpenseStatementEntry = (monthId: string, transactionId: string, accountId: string) =>
  linkExpenseStatementEntry(monthId, transactionId, accountId, db);
