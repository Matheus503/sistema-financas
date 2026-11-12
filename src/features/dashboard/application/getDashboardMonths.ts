import { dashboardMonthsRepository } from "../data/dashboardMonthsRepository";

export async function getDashboardMonths(userId: string, groupId: string) {
  let months = await dashboardMonthsRepository.getAll(groupId);

  if (months.length === 0) {
    await dashboardMonthsRepository.createCurrent(userId, groupId);
    months = await dashboardMonthsRepository.getAll(groupId);
  }

  return months;
}
