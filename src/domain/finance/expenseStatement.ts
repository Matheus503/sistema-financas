export type StatementTransaction = {
  monthId?: string; accountId?: string; date?: string; note?: string;
  id: string; year: number; month: number; value: number; accountType?: string; category?: string;
  launcherId?: string; userId?: string; launcherName?: string; userName?: string; userEmail?: string;
};

export function summarizeExpenses(transactions: StatementTransaction[], months: { year: number; month: number }[]) {
  const expenses = transactions.filter(t => t.accountType === "FIXED" || t.accountType === "VARIABLE");
  const categoryCents = new Map<string, number>();
  const byMonth = new Map<string, Map<string, number>>();
  const key = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
  for (const month of months) byMonth.set(key(month.year, month.month), new Map());
  for (const entry of expenses) {
    if (!Number.isFinite(entry.value)) throw new Error("Há lançamentos com valores inválidos.");
    const category = entry.category?.trim() || "Sem categoria";
    const cents = Math.round(entry.value * 100);
    categoryCents.set(category, (categoryCents.get(category) || 0) + cents);
    const monthKey = key(entry.year, entry.month);
    const values = byMonth.get(monthKey) || new Map<string, number>();
    values.set(category, (values.get(category) || 0) + cents);
    byMonth.set(monthKey, values);
  }
  const categories = [...categoryCents].map(([name, value]) => ({ name, value: value / 100 })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const rows = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({
    key, year: Number(key.slice(0, 4)), month: Number(key.slice(5)),
    values: Object.fromEntries([...values].map(([name, cents]) => [name, cents / 100])),
    total: [...values.values()].reduce((sum, cents) => sum + cents, 0) / 100,
  }));
  return { rows, categories, count: expenses.length,
    total: [...categoryCents.values()].reduce((sum, cents) => sum + cents, 0) / 100,
    unclassified: transactions.filter(t => !["CREDIT", "FIXED", "VARIABLE"].includes(t.accountType || "")).length,
    unclassifiedEntries: transactions.filter(t => !["CREDIT", "FIXED", "VARIABLE"].includes(t.accountType || "")),
  };
}
