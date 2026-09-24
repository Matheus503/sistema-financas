import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMonthlyReport, validDate, type SettledAccount } from "./monthlyReport";

const account = (overrides: Partial<SettledAccount> = {}): SettledAccount => ({
  monthId: "january", accountId: "salary", name: "Salário", type: "CREDIT", value: 6000,
  sourceYear: 2026, sourceMonth: 1, paidOn: "2026-01-05", ...overrides,
});

test("includes zero-activity months and excludes current and future months from averages", () => {
  const result = buildMonthlyReport([account(), account({ paidOn: "2026-03-10", value: 3000 })], [{ year: 2026, month: 1 }], 2026, "2026-03-15");
  assert.equal(result.count, 2);
  assert.equal(result.averages.received, 3000);
  assert.equal(result.totals.received, 9000);
  assert.equal(result.rows[1].received, 0);
  assert.equal(result.rows[2].status, "current");
  assert.equal(result.rows.some(row => row.month === 4), false);
});

test("uses settlement date even when the source bill belongs to another year", () => {
  const a = account({ type: "FIXED", value: 1200, sourceYear: 2025, sourceMonth: 12, paidOn: "2026-02-03" });
  const result = buildMonthlyReport([a], [{ year: 2025, month: 12 }], 2026, "2026-04-01");
  assert.equal(result.rows[0].paid, 0);
  assert.equal(result.rows[1].fixed, 1200);
  assert.equal(result.averages.paid, 400);
  assert.equal(buildMonthlyReport([a], [{ year: 2025, month: 12 }], 2025, "2026-04-01").totals.paid, 0);
});

test("legacy confirmations use their source month and are identified", () => {
  const result = buildMonthlyReport([account({ paidOn: undefined, sourceMonth: 4 })], [{ year: 2026, month: 4 }], 2026, "2026-06-01");
  assert.equal(result.legacyCount, 1);
  assert.equal(result.count, 2);
  assert.equal(result.rows[2].status, "before");
  assert.equal(result.rows[3].received, 6000);
});

test("no complete history produces unavailable averages, not misleading zeroes", () => {
  const result = buildMonthlyReport([], [{ year: 2026, month: 9 }], 2026, "2026-09-24");
  assert.equal(result.count, 0);
  assert.equal(result.averages.received, null);
  assert.equal(result.averages.paid, null);
});

test("sums fixed and variable payments in cents and preserves refunds", () => {
  const result = buildMonthlyReport([
    account({ value: 1 }), account({ type: "FIXED", value: .1 }),
    account({ type: "VARIABLE", value: .2 }), account({ type: "VARIABLE", value: -.05 }),
  ], [{ year: 2026, month: 1 }], 2026, "2026-02-01");
  assert.equal(result.rows[0].paid, .25);
  assert.equal(result.rows[0].balance, .75);
});

test("future confirmations are not realized cash flow", () => {
  const result = buildMonthlyReport([account({ paidOn: "2026-09-30" })], [{ year: 2026, month: 1 }], 2026, "2026-09-24");
  assert.equal(result.totals.received, 0);
});

test("validates calendar dates including leap years", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "invalid"]) assert.equal(validDate(value), false);
});

test("precreated future months stay hidden and outside averages", () => {
  const result = buildMonthlyReport([account()], [
    { year: 2026, month: 1 },
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
  ], 2026, "2026-03-15");
  assert.equal(result.rows.some(row => row.month === 4), false);
  assert.equal(result.rows.some(row => row.month === 5), false);
  assert.equal(result.count, 2);
  assert.equal(result.averages.received, 3000);
});

test("legacy confirmation in a future month does not reveal future cash", () => {
  const result = buildMonthlyReport([account({ sourceMonth: 10, paidOn: undefined })], [
    { year: 2026, month: 1 },
  ], 2026, "2026-09-24");
  assert.equal(result.rows.some(row => row.month === 10), false);
  assert.equal(result.totals.received, 0);
});

test("current month appears only with an effective nonzero receipt or payment", () => {
  const months = [{ year: 2026, month: 1 }, { year: 2026, month: 10 }];
  const report = (accounts: SettledAccount[]) => buildMonthlyReport(accounts, months, 2026, "2026-10-05");
  assert.equal(report([]).rows.some(row => row.month === 10), false);
  assert.equal(report([account({ paidOn: "2026-10-01", value: 0 })]).rows.some(row => row.month === 10), false);
  const result = report([account({ paidOn: "2026-10-01", value: 1500 })]);
  assert.equal(result.rows.find(row => row.month === 10)?.status, "current");
  assert.equal(result.rows.find(row => row.month === 10)?.received, 1500);
  assert.equal(result.count, 9);
});
