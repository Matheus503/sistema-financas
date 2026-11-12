import {
  getDashboardMonthData,
  setDashboardAccountPaid,
} from "../data/dashboardFinanceRepository";

export function loadDashboardMonth(monthId: string) {
  return getDashboardMonthData(monthId);
}

export function toggleDashboardAccountPaid(monthId: string, accountId: string, isPaid: boolean) {
  return setDashboardAccountPaid(monthId, accountId, isPaid);
}
