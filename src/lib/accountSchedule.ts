import type { FinanceAccount } from "../services/accountService";

export const getValidDueDay = (account: FinanceAccount) => {
  const day = Number(account.dia_vencimento);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
};

export function groupAccountsByDay(accounts: FinanceAccount[], windowDays = 3) {
  const groups = new Map<number, FinanceAccount[]>();
  let startDay: number | null = null;
  const sorted = [...accounts].sort(
    (a, b) => (getValidDueDay(a) ?? 32) - (getValidDueDay(b) ?? 32)
  );
  for (const account of sorted) {
    const day = getValidDueDay(account);
    // Anchor the window to the first due date, without chaining nearby dates.
    if (day !== null && (startDay === null || day - startDay > windowDays)) {
      startDay = day;
    }
    const key = day === null ? 32 : startDay!;
    const group = groups.get(key) ?? [];
    group.push(account);
    groups.set(key, group);
  }
  return Array.from(groups, ([day, accounts]) => ({ day, accounts }));
}
