import { getAllMonths } from "../../months/data/monthService";
import {
  deleteAccount,
  getAccountsByMonth,
  toggleAccountPaid,
  updateAccountValue,
} from "./accountService";
import { db } from "../../../lib/firestore";
import {
  createGroupAssignment,
  deleteCurrentUserAccount,
  deleteGroupMember,
  getGroupMembers,
  setActiveSpace,
} from "../../members/data/userService";
import { deleteTransaction, getTransactions, updateTransaction } from "../../transactions/data/transactionService";
import {
  ensureWebUserProfile as ensureUserProfile,
  ensureWebPersonalSpace as ensurePersonalSpace,
} from "../../auth/data/webUserProfileRepository";

export const mobileAccountRepository = {
  getAllMonths: (groupId: string) => getAllMonths(groupId, db),
  deleteAccount: (monthId: string, accountId: string) => deleteAccount(monthId, accountId, db),
  getAccountsByMonth: (monthId: string) => getAccountsByMonth(monthId, db),
  toggleAccountPaid: (monthId: string, accountId: string, current: boolean) =>
    toggleAccountPaid(monthId, accountId, current, db),
  updateAccountValue: (monthId: string, accountId: string, value: number) =>
    updateAccountValue(monthId, accountId, value, db),
  createGroupAssignment: (name: string, email: string, groupId: string, uid: string) =>
    createGroupAssignment(name, email, groupId, uid, db),
  deleteCurrentUserAccount: (profile: Parameters<typeof deleteCurrentUserAccount>[0]) =>
    deleteCurrentUserAccount(profile, db),
  deleteGroupMember: (member: Parameters<typeof deleteGroupMember>[0]) => deleteGroupMember(member, db),
  ensurePersonalSpace,
  ensureUserProfile,
  getGroupMembers: (groupId: string) => getGroupMembers(groupId, db),
  setActiveSpace: (user: Parameters<typeof setActiveSpace>[0], space: "family" | "personal") =>
    setActiveSpace(user, space, db),
  deleteTransaction: (monthId: string, transactionId: string) => deleteTransaction(monthId, transactionId, db),
  getTransactions: (monthId: string) => getTransactions(monthId, db),
  updateTransaction: (monthId: string, transactionId: string, data: Parameters<typeof updateTransaction>[2]) =>
    updateTransaction(monthId, transactionId, data, db),
};
