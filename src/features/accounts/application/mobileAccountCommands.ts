import { mobileAccountRepository } from "../data/mobileAccountRepository";

export const getMobileAccountMonths = (...args: Parameters<typeof mobileAccountRepository.getAllMonths>) =>
  mobileAccountRepository.getAllMonths(...args);
export const deleteMobileAccount = (...args: Parameters<typeof mobileAccountRepository.deleteAccount>) =>
  mobileAccountRepository.deleteAccount(...args);
export const getMobileAccountsByMonth = (...args: Parameters<typeof mobileAccountRepository.getAccountsByMonth>) =>
  mobileAccountRepository.getAccountsByMonth(...args);
export const toggleMobileAccountPaid = (...args: Parameters<typeof mobileAccountRepository.toggleAccountPaid>) =>
  mobileAccountRepository.toggleAccountPaid(...args);
export const updateMobileAccountValue = (...args: Parameters<typeof mobileAccountRepository.updateAccountValue>) =>
  mobileAccountRepository.updateAccountValue(...args);
export const inviteMobileGroupMember = (...args: Parameters<typeof mobileAccountRepository.createGroupAssignment>) =>
  mobileAccountRepository.createGroupAssignment(...args);
export const deleteMobileCurrentUserAccount = (...args: Parameters<typeof mobileAccountRepository.deleteCurrentUserAccount>) =>
  mobileAccountRepository.deleteCurrentUserAccount(...args);
export const removeMobileGroupMember = (...args: Parameters<typeof mobileAccountRepository.deleteGroupMember>) =>
  mobileAccountRepository.deleteGroupMember(...args);
export const ensureMobilePersonalSpace = (...args: Parameters<typeof mobileAccountRepository.ensurePersonalSpace>) =>
  mobileAccountRepository.ensurePersonalSpace(...args);
export const ensureMobileUserProfile = (...args: Parameters<typeof mobileAccountRepository.ensureUserProfile>) =>
  mobileAccountRepository.ensureUserProfile(...args);
export const getMobileGroupMembers = (...args: Parameters<typeof mobileAccountRepository.getGroupMembers>) =>
  mobileAccountRepository.getGroupMembers(...args);
export const setMobileActiveSpace = (...args: Parameters<typeof mobileAccountRepository.setActiveSpace>) =>
  mobileAccountRepository.setActiveSpace(...args);
export const deleteMobileTransaction = (...args: Parameters<typeof mobileAccountRepository.deleteTransaction>) =>
  mobileAccountRepository.deleteTransaction(...args);
export const getMobileTransactions = (...args: Parameters<typeof mobileAccountRepository.getTransactions>) =>
  mobileAccountRepository.getTransactions(...args);
export const updateMobileTransaction = (...args: Parameters<typeof mobileAccountRepository.updateTransaction>) =>
  mobileAccountRepository.updateTransaction(...args);
