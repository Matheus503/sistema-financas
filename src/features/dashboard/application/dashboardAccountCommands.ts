import { dashboardAccountRepository } from "../data/dashboardAccountRepository";

type MonthPeriod = { year: number; month: number };

export async function createNextDashboardMonth(
  currentMonth: MonthPeriod,
  userId: string,
  groupId: string,
) {
  let month = currentMonth.month + 1;
  let year = currentMonth.year;
  if (month === 13) {
    month = 1;
    year++;
  }
  await dashboardAccountRepository.createMonth(year, month, userId, groupId);
  return dashboardAccountRepository.getAllMonths(groupId);
}

export function saveDashboardAccountValue(monthId: string, accountId: string, value: number) {
  return dashboardAccountRepository.updateAccountValue(monthId, accountId, value);
}

export function saveDashboardExpectedAccountValue(monthId: string, accountId: string, value: number) {
  return dashboardAccountRepository.updateAccountExpectedValue(monthId, accountId, value);
}

export function removeDashboardAccount(monthId: string, accountId: string) {
  return dashboardAccountRepository.deleteAccount(monthId, accountId);
}

export function saveDashboardAccountOrder(
  monthId: string,
  orderedAccounts: { id: string; order: number }[],
) {
  return dashboardAccountRepository.updateAccountsOrder(monthId, orderedAccounts);
}

export function reloadDashboardMonths(groupId: string) {
  return dashboardAccountRepository.getAllMonths(groupId);
}
