import { getAllMonths } from "../../months/data/monthService";
import { getGroupMembers } from "../../members/data/userService";
import { getAccountsByMonth } from "../../accounts/data/accountService";
import { deleteTransaction, getTransactions, updateTransaction } from "../../transactions/data/transactionService";
import {
  anticipateInstallmentPurchase,
  cancelInstallmentPurchaseFromInstallment,
} from "../../transaction-entry/data/installmentPurchaseService";
import {
  getSavedInvoiceImport,
  saveInvoiceImport,
  updateIgnoredInvoiceEntryKeys,
  updateIgnoredSystemEntryKeys,
} from "./invoiceImportService";
import { db } from "../../../lib/firestore";
import { ensureWebUserProfile as ensureUserProfile } from "../../auth/data/webUserProfileRepository";


const getAllMonthsForWeb = (groupId: string) => getAllMonths(groupId, db);
const getGroupMembersForWeb = (groupId: string) => getGroupMembers(groupId, db);
const getAccountsByMonthForWeb = (monthId: string) => getAccountsByMonth(monthId, db);
const getTransactionsForWeb = (monthId: string) => getTransactions(monthId, db);
const updateTransactionForWeb = (monthId: string, transactionId: string, data: Parameters<typeof updateTransaction>[2]) =>
  updateTransaction(monthId, transactionId, data, db);
const deleteTransactionForWeb = (monthId: string, transactionId: string) => deleteTransaction(monthId, transactionId, db);
const anticipateInstallmentForWeb = (data: Parameters<typeof anticipateInstallmentPurchase>[0]) =>
  anticipateInstallmentPurchase(data, db);
const cancelInstallmentForWeb = (data: Parameters<typeof cancelInstallmentPurchaseFromInstallment>[0]) =>
  cancelInstallmentPurchaseFromInstallment(data, db);

export const cardStatementRepository = {
  getAllMonths: getAllMonthsForWeb,
  ensureUserProfile,
  getGroupMembers: getGroupMembersForWeb,
  getAccountsByMonth: getAccountsByMonthForWeb,
  deleteTransaction: deleteTransactionForWeb,
  getTransactions: getTransactionsForWeb,
  updateTransaction: updateTransactionForWeb,
  anticipateInstallmentPurchase: anticipateInstallmentForWeb,
  cancelInstallmentPurchaseFromInstallment: cancelInstallmentForWeb,
  getSavedInvoiceImport: (monthId: string, creditCardId: string) =>
    getSavedInvoiceImport(monthId, creditCardId, db),
  saveInvoiceImport: (data: Omit<Parameters<typeof saveInvoiceImport>[0], "firestore">) =>
    saveInvoiceImport({ ...data, firestore: db }),
  updateIgnoredInvoiceEntryKeys: (monthId: string, creditCardId: string, keys: string[]) =>
    updateIgnoredInvoiceEntryKeys(monthId, creditCardId, keys, db),
  updateIgnoredSystemEntryKeys: (monthId: string, creditCardId: string, keys: string[]) =>
    updateIgnoredSystemEntryKeys(monthId, creditCardId, keys, db),
};
