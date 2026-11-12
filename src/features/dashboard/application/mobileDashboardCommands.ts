import { mobileDashboardRepository } from "../data/mobileDashboardRepository";

export const createCurrentMonth = (...args: Parameters<typeof mobileDashboardRepository.createCurrentMonth>) => mobileDashboardRepository.createCurrentMonth(...args);
export const getAllMonths = (...args: Parameters<typeof mobileDashboardRepository.getAllMonths>) => mobileDashboardRepository.getAllMonths(...args);
export const createGroupAssignment = (...args: Parameters<typeof mobileDashboardRepository.createGroupAssignment>) => mobileDashboardRepository.createGroupAssignment(...args);
export const deleteGroupMember = (...args: Parameters<typeof mobileDashboardRepository.deleteGroupMember>) => mobileDashboardRepository.deleteGroupMember(...args);
export const deleteCurrentUserAccount = (...args: Parameters<typeof mobileDashboardRepository.deleteCurrentUserAccount>) => mobileDashboardRepository.deleteCurrentUserAccount(...args);
export const ensureUserProfile = (...args: Parameters<typeof mobileDashboardRepository.ensureUserProfile>) => mobileDashboardRepository.ensureUserProfile(...args);
export const ensurePersonalSpace = (...args: Parameters<typeof mobileDashboardRepository.ensurePersonalSpace>) => mobileDashboardRepository.ensurePersonalSpace(...args);
export const setActiveSpace = (...args: Parameters<typeof mobileDashboardRepository.setActiveSpace>) => mobileDashboardRepository.setActiveSpace(...args);
export const getGroupMembers = (...args: Parameters<typeof mobileDashboardRepository.getGroupMembers>) => mobileDashboardRepository.getGroupMembers(...args);
export const getTransactions = (...args: Parameters<typeof mobileDashboardRepository.getTransactions>) => mobileDashboardRepository.getTransactions(...args);
export const updateTransaction = (...args: Parameters<typeof mobileDashboardRepository.updateTransaction>) => mobileDashboardRepository.updateTransaction(...args);
export const deleteTransaction = (...args: Parameters<typeof mobileDashboardRepository.deleteTransaction>) => mobileDashboardRepository.deleteTransaction(...args);
export const anticipateInstallmentPurchase = (...args: Parameters<typeof mobileDashboardRepository.anticipateInstallmentPurchase>) => mobileDashboardRepository.anticipateInstallmentPurchase(...args);
export const cancelInstallmentPurchaseFromInstallment = (...args: Parameters<typeof mobileDashboardRepository.cancelInstallmentPurchaseFromInstallment>) => mobileDashboardRepository.cancelInstallmentPurchaseFromInstallment(...args);
export const getAccountsByMonth = (...args: Parameters<typeof mobileDashboardRepository.getAccountsByMonth>) => mobileDashboardRepository.getAccountsByMonth(...args);

export { ExistingOwnerAccountError } from "../data/mobileDashboardRepository";
