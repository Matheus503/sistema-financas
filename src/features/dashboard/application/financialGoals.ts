import { financialGoalsRepository } from "../data/financialGoalsRepository";
import type { FinancialGoalInput } from "../../../domain/finance/financialGoal";

export function loadFinancialGoals(
  groupId: string,
  year: number,
  month: number,
  monthId: string,
) {
  return financialGoalsRepository.getData(groupId, year, month, monthId);
}

export function saveFinancialGoalForMonth(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  input: FinancialGoalInput,
  goalId?: string,
) {
  return financialGoalsRepository.save(
    groupId,
    userId,
    year,
    month,
    monthId,
    input,
    goalId,
  );
}

export function confirmGoalContributionForMonth(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  goalId: string,
) {
  return financialGoalsRepository.confirmContribution(
    groupId,
    userId,
    year,
    month,
    monthId,
    goalId,
  );
}

export function removeFinancialGoal(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  goalId: string,
) {
  return financialGoalsRepository.delete(
    groupId,
    userId,
    year,
    month,
    monthId,
    goalId,
  );
}
