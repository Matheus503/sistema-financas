export type SettledAccount = {
  monthId: string;
  accountId: string;
  name: string;
  type: "CREDIT" | "FIXED" | "VARIABLE";
  value: number;
  sourceYear: number;
  sourceMonth: number;
  paidOn?: string;
};

export type MonthlyReportAdjustments = Record<string, {
  investmentCents?: number;
  goalContributionCents?: number;
}>;

export const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900 && localDate(date) === value;
}

export function buildMonthlyReport(
  accounts: SettledAccount[],
  months: { year: number; month: number }[],
  year: number,
  today = localDate(),
  adjustmentsByMonth: MonthlyReportAdjustments = {},
) {
  const currentOrder = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
  const orders = [...months, ...accounts.map(account => ({ year: account.sourceYear, month: account.sourceMonth }))]
    .map(m => m.year * 12 + m.month);
  const firstOrder = orders.length ? Math.min(...orders) : Infinity;
  const rows = monthNames.map((name, index) => {
    const month = index + 1;
    const order = year * 12 + month;
    const status = order > currentOrder ? "future" : order < firstOrder ? "before" : order === currentOrder ? "current" : "complete";
    const entries = accounts.filter(account =>
      order <= currentOrder && account.sourceYear === year && account.sourceMonth === month,
    );
    const total = (type: SettledAccount["type"]) => entries.filter(a => a.type === type).reduce((sum, a) => sum + Math.round(a.value * 100), 0) / 100;
    const received = total("CREDIT"), fixed = total("FIXED"), variable = total("VARIABLE");
    const paid = Math.round((fixed + variable) * 100) / 100;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const investment = Math.round(Number(adjustmentsByMonth[key]?.investmentCents || 0)) / 100;
    const goalContribution = Math.round(Number(adjustmentsByMonth[key]?.goalContributionCents || 0)) / 100;
    const balance = Math.round((received - paid - investment - goalContribution) * 100) / 100;
    return { month, name, shortName: name.slice(0, 3), status, received, fixed, variable, paid, investment, goalContribution, balance, entries };
  }).filter(row => row.status !== "future" && (row.status !== "current" || row.entries.some(entry => Math.round(entry.value * 100) !== 0) || row.investment !== 0 || row.goalContribution !== 0));
  const complete = rows.filter(row => row.status === "complete");
  const keys = ["received", "fixed", "variable", "paid", "investment", "goalContribution", "balance"] as const;
  const summarize = (items: typeof rows) => Object.fromEntries(keys.map(key => [key, items.reduce((sum, row) => sum + Math.round(row[key] * 100), 0) / 100])) as Record<typeof keys[number], number>;
  const totals = summarize(rows.filter(row => row.status === "complete" || row.status === "current"));
  const completedTotals = summarize(complete);
  const averages = Object.fromEntries(keys.map(key => [key, complete.length ? completedTotals[key] / complete.length : null])) as Record<typeof keys[number], number | null>;
  return { rows, totals, averages, count: complete.length, complete, legacyCount: rows.flatMap(row => row.entries).filter(a => !a.paidOn || !validDate(a.paidOn)).length };
}
