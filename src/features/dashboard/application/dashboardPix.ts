import { dashboardPixRepository } from "../data/dashboardPixRepository";

type PixTransactionChange = {
  monthId: string;
  transactionId: string;
  accountId: string;
  currentAccountValue: number;
  previousTransactionValue: number;
  nextTransactionValue: number;
};

export async function updateDashboardPixTransaction(change: PixTransactionChange) {
  const delta = change.nextTransactionValue - change.previousTransactionValue;
  const nextAccountValue = change.currentAccountValue + delta;

  await dashboardPixRepository.updateTransaction(change.monthId, change.transactionId, {
    value: change.nextTransactionValue,
  });
  await dashboardPixRepository.updateAccountValue(change.monthId, change.accountId, nextAccountValue);
  return nextAccountValue;
}

type PixTransactionRemoval = Omit<PixTransactionChange, "nextTransactionValue">;

export async function removeDashboardPixTransaction(change: PixTransactionRemoval) {
  const nextAccountValue = change.currentAccountValue - change.previousTransactionValue;

  await dashboardPixRepository.deleteTransaction(change.monthId, change.transactionId);
  await dashboardPixRepository.updateAccountValue(change.monthId, change.accountId, nextAccountValue);
  return nextAccountValue;
}
