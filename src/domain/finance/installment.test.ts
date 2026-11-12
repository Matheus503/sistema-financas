import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonthsToInvoice,
  buildInstallmentSchedule,
  getCreditCardKey,
  getInvoiceMonth,
  getMonthIndex,
  matchesSelectedCreditCard,
  splitCurrencyInCents,
  validateInvoiceMonthRange,
} from "./installment";

test("moves card purchases on the closing day into the next invoice month", () => {
  assert.deepEqual(getInvoiceMonth("2026-12-11", 12), { year: 2026, month: 12 });
  assert.deepEqual(getInvoiceMonth("2026-12-12", 12), { year: 2027, month: 1 });
});

test("adds invoice months across year boundaries and compares their indexes", () => {
  const next = addMonthsToInvoice({ year: 2026, month: 12 }, 2);
  assert.deepEqual(next, { year: 2027, month: 2 });
  assert.equal(getMonthIndex(next) - getMonthIndex({ year: 2026, month: 12 }), 2);
});

test("allows only the selected invoice and the following one", () => {
  const reference = { year: 2026, month: 12 };
  assert.equal(validateInvoiceMonthRange("2026-12-10", 12, reference).isWithinAllowedRange, true);
  assert.equal(validateInvoiceMonthRange("2026-12-12", 12, reference).isWithinAllowedRange, true);
  assert.equal(validateInvoiceMonthRange("2027-01-12", 12, reference).isWithinAllowedRange, false);
});

test("splits installment totals in cents without losing the remainder", () => {
  const installments = splitCurrencyInCents(10.01, 3);
  assert.deepEqual(installments, [334, 334, 333]);
  assert.equal(installments.reduce((sum, value) => sum + value, 0), 1001);
});

test("builds invoice dates, installment labels and values as one schedule", () => {
  const schedule = buildInstallmentSchedule("2026-12-12", 12, 10.01, 3, " Compra ");
  assert.deepEqual(schedule.firstInvoiceMonth, { year: 2027, month: 1 });
  assert.deepEqual(schedule.nextInvoiceMonth, { year: 2027, month: 2 });
  assert.deepEqual(schedule.installments, [
    { year: 2027, month: 1, installmentNumber: 1, valueCents: 334, note: "Compra (1/3)" },
    { year: 2027, month: 2, installmentNumber: 2, valueCents: 334, note: "Compra (2/3)" },
    { year: 2027, month: 3, installmentNumber: 3, valueCents: 333, note: "Compra (3/3)" },
  ]);
});

test("uses the default installment label when the purchase has no note", () => {
  const schedule = buildInstallmentSchedule("2026-01-10", 12, 5, 2, "   ");
  assert.deepEqual(schedule.installments.map((item) => item.note), [
    "Parcela 1/2",
    "Parcela 2/2",
  ]);
});

test("matches installment accounts by stable card key or card details", () => {
  const selected = {
    id: "card-1",
    name: "Cartão Azul",
    type: "VARIABLE",
    isCreditCard: true,
    dia_vencimento: 20,
    dia_fechamento: 12,
  };
  assert.equal(getCreditCardKey(selected), "card-1");
  assert.equal(matchesSelectedCreditCard({ ...selected, id: "other" }, selected), true);
  assert.equal(matchesSelectedCreditCard({ ...selected, name: "Outro cartão", id: "other" }, selected), false);
});
