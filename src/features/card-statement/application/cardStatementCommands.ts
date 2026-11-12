import { cardStatementRepository } from "../data/cardStatementRepository";

export const loadCardStatementMonths = (...args: Parameters<typeof cardStatementRepository.getAllMonths>) => cardStatementRepository.getAllMonths(...args);
export const ensureCardStatementProfile = (...args: Parameters<typeof cardStatementRepository.ensureUserProfile>) => cardStatementRepository.ensureUserProfile(...args);
export const loadCardStatementMembers = (...args: Parameters<typeof cardStatementRepository.getGroupMembers>) => cardStatementRepository.getGroupMembers(...args);
export const loadCardStatementAccounts = (...args: Parameters<typeof cardStatementRepository.getAccountsByMonth>) => cardStatementRepository.getAccountsByMonth(...args);
export const removeCardStatementTransaction = (...args: Parameters<typeof cardStatementRepository.deleteTransaction>) => cardStatementRepository.deleteTransaction(...args);
export const loadCardStatementTransactions = (...args: Parameters<typeof cardStatementRepository.getTransactions>) => cardStatementRepository.getTransactions(...args);
export const saveCardStatementTransaction = (...args: Parameters<typeof cardStatementRepository.updateTransaction>) => cardStatementRepository.updateTransaction(...args);
export const anticipateCardStatementInstallments = (...args: Parameters<typeof cardStatementRepository.anticipateInstallmentPurchase>) => cardStatementRepository.anticipateInstallmentPurchase(...args);
export const cancelCardStatementInstallments = (...args: Parameters<typeof cardStatementRepository.cancelInstallmentPurchaseFromInstallment>) => cardStatementRepository.cancelInstallmentPurchaseFromInstallment(...args);
export const loadSavedCardStatementInvoiceImport = (...args: Parameters<typeof cardStatementRepository.getSavedInvoiceImport>) => cardStatementRepository.getSavedInvoiceImport(...args);
export const saveCardStatementInvoiceImport = (...args: Parameters<typeof cardStatementRepository.saveInvoiceImport>) => cardStatementRepository.saveInvoiceImport(...args);
export const updateIgnoredCardStatementInvoiceEntryKeys = (...args: Parameters<typeof cardStatementRepository.updateIgnoredInvoiceEntryKeys>) => cardStatementRepository.updateIgnoredInvoiceEntryKeys(...args);
export const updateIgnoredCardStatementSystemEntryKeys = (...args: Parameters<typeof cardStatementRepository.updateIgnoredSystemEntryKeys>) => cardStatementRepository.updateIgnoredSystemEntryKeys(...args);
