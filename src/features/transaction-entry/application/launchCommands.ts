import { launchRepository } from "../data/launchRepository";

export const ensureLaunchUserProfile = (...args: Parameters<typeof launchRepository.ensureUserProfile>) =>
  launchRepository.ensureUserProfile(...args);

export const loadLaunchCategories = (...args: Parameters<typeof launchRepository.getCategories>) =>
  launchRepository.getCategories(...args);

export const createLaunchCategory = (...args: Parameters<typeof launchRepository.createCategory>) =>
  launchRepository.createCategory(...args);

export const renameLaunchCategory = (...args: Parameters<typeof launchRepository.updateCategoryName>) =>
  launchRepository.updateCategoryName(...args);

export const removeLaunchCategory = (...args: Parameters<typeof launchRepository.deleteCategory>) =>
  launchRepository.deleteCategory(...args);

export const createLaunchAccount = (...args: Parameters<typeof launchRepository.createAccount>) =>
  launchRepository.createAccount(...args);

export const loadLaunchMonthAccounts = (...args: Parameters<typeof launchRepository.getAccountsByMonth>) =>
  launchRepository.getAccountsByMonth(...args);

export const updateLaunchAccountValue = (...args: Parameters<typeof launchRepository.updateAccountValue>) =>
  launchRepository.updateAccountValue(...args);

export const createLaunchMonth = (...args: Parameters<typeof launchRepository.createMonth>) =>
  launchRepository.createMonth(...args);

export const loadLaunchMonths = (...args: Parameters<typeof launchRepository.getAllMonths>) =>
  launchRepository.getAllMonths(...args);

export const createLaunchInstallmentPurchase = (...args: Parameters<typeof launchRepository.createInstallmentPurchase>) =>
  launchRepository.createInstallmentPurchase(...args);

export const createLaunchTransaction = (...args: Parameters<typeof launchRepository.addTransaction>) =>
  launchRepository.addTransaction(...args);
