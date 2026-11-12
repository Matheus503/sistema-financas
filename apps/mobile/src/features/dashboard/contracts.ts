import type { FinanceAccount } from "../../../../../src/domain/finance/account";
import type { FinanceTransaction } from "../../../../../src/domain/finance/transaction";

export type MobileDashboardAdjustments = {
  investmentImpactCents: number;
  goalContributionCents: number;
};

export type MobileDashboardMonthData = {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
};
