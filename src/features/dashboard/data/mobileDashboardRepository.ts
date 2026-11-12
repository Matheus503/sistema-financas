import { createCurrentMonth, getAllMonths } from "../../months/data/monthService";
import {
  createGroupAssignment,
  deleteGroupMember,
  deleteCurrentUserAccount,
  setActiveSpace,
  getGroupMembers,
} from "../../members/data/userService";
import {
  ensureWebUserProfile as ensureUserProfile,
  ensureWebPersonalSpace as ensurePersonalSpace,
  ExistingOwnerAccountError,
} from "../../auth/data/webUserProfileRepository";
import { getTransactions, updateTransaction, deleteTransaction } from "../../transactions/data/transactionService";
import {
  anticipateInstallmentPurchase,
  cancelInstallmentPurchaseFromInstallment,
} from "../../transaction-entry/data/installmentPurchaseService";
import { getAccountsByMonth } from "../../accounts/data/accountService";
import { db } from "../../../lib/firestore";

const createCurrentMonthForWeb = (userId: string, groupId: string) => createCurrentMonth(userId, groupId, db);
const getAllMonthsForWeb = (groupId: string) => getAllMonths(groupId, db);
const createGroupAssignmentForWeb = (name: string, email: string, groupId: string, uid: string) =>
  createGroupAssignment(name, email, groupId, uid, db);
const deleteGroupMemberForWeb = (member: Parameters<typeof deleteGroupMember>[0]) => deleteGroupMember(member, db);
const deleteCurrentUserAccountForWeb = (profile: Parameters<typeof deleteCurrentUserAccount>[0]) =>
  deleteCurrentUserAccount(profile, db);
const setActiveSpaceForWeb = (user: Parameters<typeof setActiveSpace>[0], space: "family" | "personal") =>
  setActiveSpace(user, space, db);
const getGroupMembersForWeb = (groupId: string) => getGroupMembers(groupId, db);
const getTransactionsForWeb = (monthId: string) => getTransactions(monthId, db);
const updateTransactionForWeb = (monthId: string, transactionId: string, data: Parameters<typeof updateTransaction>[2]) =>
  updateTransaction(monthId, transactionId, data, db);
const deleteTransactionForWeb = (monthId: string, transactionId: string) => deleteTransaction(monthId, transactionId, db);
const anticipateInstallmentForWeb = (data: Parameters<typeof anticipateInstallmentPurchase>[0]) =>
  anticipateInstallmentPurchase(data, db);
const cancelInstallmentForWeb = (data: Parameters<typeof cancelInstallmentPurchaseFromInstallment>[0]) =>
  cancelInstallmentPurchaseFromInstallment(data, db);
const getAccountsByMonthForWeb = (monthId: string) => getAccountsByMonth(monthId, db);

export const mobileDashboardRepository = {
  createCurrentMonth: createCurrentMonthForWeb,
  getAllMonths: getAllMonthsForWeb,
  createGroupAssignment: createGroupAssignmentForWeb,
  deleteGroupMember: deleteGroupMemberForWeb,
  deleteCurrentUserAccount: deleteCurrentUserAccountForWeb,
  ensureUserProfile,
  ensurePersonalSpace,
  setActiveSpace: setActiveSpaceForWeb,
  getGroupMembers: getGroupMembersForWeb,
  getTransactions: getTransactionsForWeb,
  updateTransaction: updateTransactionForWeb,
  deleteTransaction: deleteTransactionForWeb,
  anticipateInstallmentPurchase: anticipateInstallmentForWeb,
  cancelInstallmentPurchaseFromInstallment: cancelInstallmentForWeb,
  getAccountsByMonth: getAccountsByMonthForWeb,
};

export { ExistingOwnerAccountError };
