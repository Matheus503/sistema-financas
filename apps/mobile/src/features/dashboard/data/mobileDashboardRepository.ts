import type { Firestore } from "firebase/firestore";
import type { FinanceMonth } from "../../../../../../src/domain/finance/month";
import type { FinanceAccount } from "../../../../../../src/domain/finance/account";
import type { AddTransactionPayload } from "../../../../../../src/domain/finance/transaction";
import type { CreateInstallmentPurchaseData } from "../../../../../../src/domain/finance/installment";
import type { MobileDashboardAdjustments, MobileDashboardMonthData } from "../contracts";
import type { MonthlyReportSourceData } from "../../../../../../src/domain/finance/monthlyReport";
import { createMonth, getAllMonths } from "../../../../../../src/features/months/data/monthService";
import { createAccount, deleteAccount as deleteInstallmentAccount, deleteCommonAccount, getAccountsByMonth, toggleAccountPaid, updateAccountDetails, updateCommonAccountDetails, updateAccountPaidOn } from "../../../../../../src/features/accounts/data/accountService";
import { updateAccountValue } from "../../../../../../src/features/accounts/data/accountService";
import { addTransaction, getTransactions, updateTransaction, deleteTransaction } from "../../../../../../src/features/transactions/data/transactionService";
import { seedDefaultCategoriesForGroup } from "../../../../../../src/features/categories/data/categoryService";
import { cancelInstallmentPurchaseFromInstallment, createInstallmentPurchase } from "../../../../../../src/features/transaction-entry/data/installmentPurchaseService";
import { getInvestorMonthlyBalanceImpacts } from "../../../../../../src/features/dashboard/data/investmentService";
import { getFinancialGoalContributionsByMonth } from "../../../../../../src/features/financial-goals/data/financialGoalsService";
import { getGroupMembers } from "../../../../../../src/features/members/data/userService";
import { getMonthlyReportSource } from "../../../../../../src/features/monthly-report/data/monthlyReportRepository";

export function createMobileDashboardRepository(firestore: Firestore) {
  return {
    getMonths: (groupId: string) => getAllMonths(groupId, firestore),
    getCategories: (groupId: string) => seedDefaultCategoriesForGroup(groupId, {}, firestore),
    createMonth: (year: number, month: number, userId: string, groupId: string) =>
      createMonth(year, month, userId, groupId, firestore),
    createAccount: (monthId: string, data: Omit<FinanceAccount, "id">) =>
      createAccount(monthId, data, firestore),
    updateAccountValue: (monthId: string, accountId: string, value: number) =>
      updateAccountValue(monthId, accountId, value, firestore),
    addTransaction: (monthId: string, data: AddTransactionPayload) =>
      addTransaction(monthId, data, firestore),
    updateTransaction: (monthId: string, transactionId: string, data: { value?: number; category?: string; note?: string; date?: string }) =>
      updateTransaction(monthId, transactionId, data, firestore),
    deleteTransaction: (monthId: string, transactionId: string) =>
      deleteTransaction(monthId, transactionId, firestore),
    cancelInstallment: (data: { groupId: string; currentMonthId: string; installmentGroupId: string; currentInstallment: number }) =>
      cancelInstallmentPurchaseFromInstallment(data, firestore),
    createInstallmentPurchase: (data: CreateInstallmentPurchaseData) =>
      createInstallmentPurchase(data, firestore),
    toggleAccountPaid: (monthId: string, accountId: string, current: boolean) =>
      toggleAccountPaid(monthId, accountId, current, firestore),
    updateAccountDetails: (monthId: string, accountId: string, data: { name: string; value: number; dia_vencimento?: number }) =>
      updateCommonAccountDetails(monthId, accountId, data, firestore),
    updateSpecialAccountDetails: (monthId: string, accountId: string, data: { name: string; value?: number; dia_vencimento?: number; dia_fechamento?: number; isArchived?: boolean; isPrimaryCreditCard?: boolean }) =>
      updateAccountDetails(monthId, accountId, data, firestore),
    deleteAccount: (monthId: string, accountId: string) => deleteCommonAccount(monthId, accountId, firestore),
    deleteInstallmentAccount: (monthId: string, accountId: string) => deleteInstallmentAccount(monthId, accountId, firestore),
    getGroupMembers: (groupId: string) => getGroupMembers(groupId, firestore),
    getMonthlyReportSource: (groupId: string): Promise<MonthlyReportSourceData> => getMonthlyReportSource(groupId, firestore),
    updateSettlementDate: (monthId: string, accountId: string, date: string) =>
      updateAccountPaidOn(monthId, accountId, date, firestore),
    async getMonthAdjustments(
      groupId: string,
      months: FinanceMonth[],
    ): Promise<Record<string, MobileDashboardAdjustments>> {
      if (!months.length) return {};

      const [investmentImpacts, goalContributions] = await Promise.all([
        getInvestorMonthlyBalanceImpacts(groupId, months, firestore),
        getFinancialGoalContributionsByMonth(groupId, firestore),
      ]);

      return Object.fromEntries(months.map((month) => {
        const monthKey = `${month.year}-${String(month.month).padStart(2, "0")}`;
        return [month.id, {
          investmentImpactCents: Math.round((investmentImpacts.get(month.id) || 0) * 100),
          goalContributionCents: goalContributions.get(monthKey) || 0,
        }];
      }));
    },
    async getMonthData(monthId: string): Promise<MobileDashboardMonthData> {
      const [accounts, transactions] = await Promise.all([
        getAccountsByMonth(monthId, firestore),
        getTransactions(monthId, firestore),
      ]);
      return { accounts, transactions };
    },
  };
}
