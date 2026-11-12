import { createAccount, getAccountsByMonth, updateAccountValue } from "../../accounts/data/accountService";
import { addTransaction } from "../../transactions/data/transactionService";
import { createMonth, getAllMonths } from "../../months/data/monthService";
import { createInstallmentPurchase } from "./installmentPurchaseService";
import { ensureWebUserProfile as ensureUserProfile } from "../../auth/data/webUserProfileRepository";
import { createCategory, deleteCategory, seedDefaultCategoriesForGroup, updateCategoryName } from "../../categories/data/categoryService";
import { db } from "../../../lib/firestore";

const createGroupCategory = (groupId: string, name: string, order: number) =>
  createCategory(groupId, name, order, db);
const getGroupCategories = (groupId: string, options: Parameters<typeof seedDefaultCategoriesForGroup>[1] = {}) =>
  seedDefaultCategoriesForGroup(groupId, options, db);
const renameCategory = (categoryId: string, name: string) =>
  updateCategoryName(categoryId, name, db);
const removeCategory = (categoryId: string) => deleteCategory(categoryId, db);
const createLaunchAccount = (monthId: string, data: Parameters<typeof createAccount>[1]) =>
  createAccount(monthId, data, db);
const getLaunchAccounts = (monthId: string) => getAccountsByMonth(monthId, db);
const setLaunchAccountValue = (monthId: string, accountId: string, value: number) =>
  updateAccountValue(monthId, accountId, value, db);
const createLaunchMonth = (year: number, month: number, userId: string, groupId: string) =>
  createMonth(year, month, userId, groupId, db);
const getLaunchMonths = (groupId: string) => getAllMonths(groupId, db);
const saveInstallmentPurchase = (data: Parameters<typeof createInstallmentPurchase>[0]) =>
  createInstallmentPurchase(data, db);
const addLaunchTransaction = (monthId: string, data: Parameters<typeof addTransaction>[1]) =>
  addTransaction(monthId, data, db);

export const launchRepository = {
  ensureUserProfile,
  getCategories: getGroupCategories,
  createCategory: createGroupCategory,
  updateCategoryName: renameCategory,
  deleteCategory: removeCategory,
  createAccount: createLaunchAccount,
  getAccountsByMonth: getLaunchAccounts,
  updateAccountValue: setLaunchAccountValue,
  createMonth: createLaunchMonth,
  getAllMonths: getLaunchMonths,
  createInstallmentPurchase: saveInstallmentPurchase,
  addTransaction: addLaunchTransaction,
};
