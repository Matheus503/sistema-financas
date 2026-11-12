import { db } from "../../../lib/firestore";
import { getMonthlyReportSource, updateMonthlyReportSettlementDate } from "./monthlyReportRepository";

export const webMonthlyReportRepository = {
  getSource: (groupId: string) => getMonthlyReportSource(groupId, db),
  updateSettlementDate: (monthId: string, accountId: string, date: string) =>
    updateMonthlyReportSettlementDate(monthId, accountId, date, db),
};
