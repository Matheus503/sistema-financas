export type FinancialGoal = {
  id: string;
  name: string;
  targetAmountCents: number;
  durationMonths: number;
  monthlyAmountCents: number;
  plannedMonthlyCents: number;
  confirmedThisMonthCents: number;
  isConfirmedThisMonth: boolean;
  reservedAmountCents: number;
  reservedBeforeMonthCents: number;
};

export type FinancialGoalInput = {
  name: string;
  targetAmountCents: number;
  durationMonths: number;
};

export type FinancialGoalsData = {
  goals: FinancialGoal[];
  monthlyPlanCents: number;
};
