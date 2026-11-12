import { createCurrentMonth, getAllMonths } from "../../months/data/monthService";
import { db } from "../../../lib/firestore";

export const dashboardMonthsRepository = {
  getAll: (groupId: string) => getAllMonths(groupId, db),
  createCurrent: (userId: string, groupId: string) => createCurrentMonth(userId, groupId, db),
};
