import {
  confirmFinancialGoalContribution,
  deleteFinancialGoal,
  getFinancialGoalsData,
  saveFinancialGoal,
  updateFinancialGoalContribution,
} from "../../financial-goals/data/financialGoalsService";
import type { FinancialGoalContributionInput, FinancialGoalInput } from "../../../domain/finance/financialGoal";
import { db } from "../../../lib/firestore";

export const financialGoalsRepository = {
  getData: (groupId: string, year: number, month: number, monthId: string) =>
    getFinancialGoalsData(groupId, year, month, monthId, db),
  save: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    input: FinancialGoalInput,
    goalId?: string,
  ) => saveFinancialGoal(groupId, userId, year, month, monthId, input, goalId, db),
  confirmContribution: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    goalId: string,
    input: FinancialGoalContributionInput,
  ) => confirmFinancialGoalContribution(groupId, userId, year, month, monthId, goalId, input, db),
  updateContribution: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    goalId: string,
    input: FinancialGoalContributionInput,
  ) => updateFinancialGoalContribution(groupId, userId, year, month, monthId, goalId, input, db),
  delete: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    goalId: string,
  ) => deleteFinancialGoal(groupId, userId, year, month, monthId, goalId, db),
};
