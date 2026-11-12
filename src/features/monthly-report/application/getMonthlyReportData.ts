import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { mapMonthlyReportSource } from "../../../domain/finance/monthlyReport";
import { getMonthlyReportSource, updateMonthlyReportSettlementDate } from "../data/monthlyReportRepository";
import { getMonthlyReportGroupForUser } from "../data/monthlyReportUserRepository";
import { webMonthlyReportRepository } from "../data/webMonthlyReportRepository";

export async function getMonthlyReportForUser(user: User) {
  const groupId = await getMonthlyReportGroupForUser(user);
  return getMonthlyReportData(groupId);
}

export function saveMonthlyReportSettlementDate(monthId: string, accountId: string, date: string, firestore?: Firestore) {
  return firestore
    ? updateMonthlyReportSettlementDate(monthId, accountId, date, firestore)
    : webMonthlyReportRepository.updateSettlementDate(monthId, accountId, date);
}

export async function getMonthlyReportData(groupId: string, firestore?: Firestore) {
  const source = firestore
    ? await getMonthlyReportSource(groupId, firestore)
    : await webMonthlyReportRepository.getSource(groupId);
  return mapMonthlyReportSource(source);
}
