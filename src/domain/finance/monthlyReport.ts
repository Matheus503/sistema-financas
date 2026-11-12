import { localDate, validDate } from "../../shared/date";
import { monthNames } from "../../shared/months";
import type { FinanceAccount } from "./account";
import { isCreditCardAccount } from "./accountBalance";

export type MonthlyReportMonth = { id: string; year: number; month: number };

export type MonthlyReportSource = {
  month: MonthlyReportMonth;
  accounts: FinanceAccount[];
  cardTransactions: { accountId?: string; value?: number }[];
};

export type MonthlyReportSourceData = {
  months: MonthlyReportMonth[];
  sources: MonthlyReportSource[];
  investmentImpacts: ReadonlyMap<string, number>;
  goalContributions: ReadonlyMap<string, number>;
};

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

export function mapMonthlyReportSource({ months, sources, investmentImpacts, goalContributions }: MonthlyReportSourceData) {
  const accounts: SettledAccount[] = [];
  // Totals stay with the account's reference month; confirmation days can be approximate.
  for (const source of sources) {
    const cardTotals = new Map<string, number>();
    for (const transaction of source.cardTransactions) {
      if (transaction.accountId && Number.isFinite(Number(transaction.value))) {
        cardTotals.set(transaction.accountId,
          (cardTotals.get(transaction.accountId) || 0) + Math.round(Number(transaction.value) * 100));
      }
    }
    accounts.push(...source.accounts.map(account => ({
      monthId: source.month.id,
      accountId: account.id,
      name: account.name,
      type: account.type as SettledAccount["type"],
      value: (Math.round(Number(account.value || 0) * 100)
        + (isCreditCardAccount(account) ? cardTotals.get(account.id) || 0 : 0)) / 100,
      sourceYear: source.month.year,
      sourceMonth: source.month.month,
      paidOn: account.paidOn,
    })));
  }
  if (accounts.some(account => !Number.isFinite(account.value))) {
    throw new Error("Há contas com valores inválidos. Corrija-as antes de consultar o relatório.");
  }
  const adjustmentsByMonth = Object.fromEntries(months.map(month => {
    const key = `${month.year}-${String(month.month).padStart(2, "0")}`;
    return [key, {
      investmentCents: investmentImpacts.get(month.id) || 0,
      goalContributionCents: goalContributions.get(key) || 0,
    }];
  }));
  return { accounts, months, adjustmentsByMonth };
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
