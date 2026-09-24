import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeExpenses, type StatementTransaction } from "./expenseStatement";
const entry = (overrides: Partial<StatementTransaction> = {}): StatementTransaction => ({ id: "1", year: 2026, month: 1, value: 10, category: "Mercado", accountType: "VARIABLE", ...overrides });

test("separates matching months from different years in chronological order", () => {
  const result = summarizeExpenses([entry(), entry({ year: 2025, value: 20 })], []);
  assert.deepEqual(result.rows.map(r => [r.key, r.total]), [["2025-01", 20], ["2026-01", 10]]);
  assert.equal(result.total, 30);
});
test("excludes income and reports unknown account types without treating them as expenses", () => {
  const result = summarizeExpenses([entry(), entry({ accountType: "CREDIT", value: 5000 }), entry({ accountType: undefined, value: 50 }), entry({ accountType: "FIXED", value: 20 })], []);
  assert.equal(result.total, 30);
  assert.equal(result.count, 2);
  assert.equal(result.unclassified, 1);
  assert.equal(result.unclassifiedEntries[0].value, 50);
});

test("linking an unidentified entry resolves the notice and updates expense totals", () => {
  const orphan = entry({ accountType: undefined, monthId: "jan", note: "Compra" });
  assert.equal(summarizeExpenses([orphan], []).unclassifiedEntries.length, 1);
  const linked = summarizeExpenses([{ ...orphan, accountType: "VARIABLE", accountId: "card" }], []);
  assert.equal(linked.unclassifiedEntries.length, 0);
  assert.equal(linked.total, 10);
  assert.equal(summarizeExpenses([{ ...orphan, accountType: "CREDIT" }], []).total, 0);
});
test("preserves refunds, missing categories and exact cent totals", () => {
  const result = summarizeExpenses([entry({ value: .1 }), entry({ value: .2 }), entry({ value: -.05 }), entry({ value: -.4, category: " " })], []);
  assert.equal(result.total, -.15);
  assert.deepEqual(result.categories, [{ name: "Mercado", value: .25 }, { name: "Sem categoria", value: -.4 }]);
});
test("includes selected empty months without inventing other periods", () => {
  const result = summarizeExpenses([], [{ year: 2026, month: 2 }]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].key, "2026-02");
  assert.equal(result.total, 0);
});
test("rejects invalid expense amounts", () => {
  assert.throws(() => summarizeExpenses([entry({ value: NaN })], []));
});
