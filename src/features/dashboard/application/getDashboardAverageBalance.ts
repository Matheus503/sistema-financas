import { buildMonthlyReport } from "../../../domain/finance/monthlyReport";
import { getMonthlyReportData } from "../../monthly-report/application/getMonthlyReportData";

export async function getDashboardAverageBalance(groupId: string) {
  const data = await getMonthlyReportData(groupId);
  return buildMonthlyReport(
    data.accounts,
    data.months,
    new Date().getFullYear(),
    undefined,
    data.adjustmentsByMonth,
  ).averages.balance;
}
