import type { Firestore } from "firebase/firestore";
import type { MonthlyReportSource } from "../../../domain/finance/monthlyReport";
import { getAccountsByMonth, updateAccountPaidOn } from "../../accounts/data/accountService";
import { isCreditCardAccount } from "../../../domain/finance/account";
import { getAllMonths } from "../../months/data/monthService";
import { getTransactions } from "../../transactions/data/transactionService";
import { getFinancialGoalContributionsByMonth } from "../../financial-goals/data/financialGoalsService";
import { getInvestorMonthlyBalanceImpacts } from "../../dashboard/data/investmentService";

export type { MonthlyReportMonth, MonthlyReportSource } from "../../../domain/finance/monthlyReport";

export async function getMonthlyReportSource(groupId: string, firestore: Firestore) {
  const documents = await getAllMonths(groupId, firestore);
  const months = documents
    .map(month => ({ id: month.id, year: Number(month.year), month: Number(month.month) }))
    .filter(month => Number.isInteger(month.year) && month.year >= 1900
      && Number.isInteger(month.month) && month.month >= 1 && month.month <= 12);

  const adjustmentsPromise = Promise.all([
    getInvestorMonthlyBalanceImpacts(groupId, months, firestore),
    getFinancialGoalContributionsByMonth(groupId, firestore),
  ]);
  const sources: MonthlyReportSource[] = [];

  // Bound Firestore reads for groups with a long history.
  for (let start = 0; start < months.length; start += 6) {
    const batch = await Promise.all(months.slice(start, start + 6).map(async month => {
      const accounts = await getAccountsByMonth(month.id, firestore);
      const settledAccounts = accounts.filter(account => account.isPaid
        && ["CREDIT", "FIXED", "VARIABLE"].includes(account.type));
      const cardTransactions = settledAccounts.some(isCreditCardAccount)
        ? await getTransactions(month.id, firestore)
        : [];
      return { month, accounts: settledAccounts, cardTransactions };
    }));
    sources.push(...batch);
  }

  const [investmentImpacts, goalContributions] = await adjustmentsPromise;
  return { months, sources, investmentImpacts, goalContributions };
}

export function updateMonthlyReportSettlementDate(monthId: string, accountId: string, date: string, firestore: Firestore) {
  return updateAccountPaidOn(monthId, accountId, date, firestore);
}
