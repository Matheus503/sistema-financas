import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileAgendaSections } from "./mobileAgenda";

test("builds pending credit and payment groups using shared account totals", () => {
  const sections = buildMobileAgendaSections([
    { id: "salary", name: "Salário", type: "CREDIT", value: 5000, dia_vencimento: 5 },
    { id: "rent", name: "Aluguel", type: "FIXED", value: 1200, dia_vencimento: 1 },
    { id: "energy", name: "Energia", type: "VARIABLE", value: 150, dia_vencimento: 3, isPaid: true },
    { id: "pix", name: "PIX", type: "VARIABLE", value: 75, isPaid: false },
  ], new Map());

  assert.deepEqual(sections[0].groups, [
    { day: 5, total: 5000, pending: 5000 },
  ]);
  assert.deepEqual(sections[1].groups, [
    { day: 1, total: 1350, pending: 1200 },
  ]);
});

test("includes card transactions in scheduled totals and omits settled groups", () => {
  const sections = buildMobileAgendaSections([
    { id: "salary", name: "Salário", type: "CREDIT", value: 5000, isPaid: true, dia_vencimento: 5 },
    { id: "card", name: "Cartão", type: "VARIABLE", value: 0, isCreditCard: true, dia_vencimento: 20 },
  ], new Map([["card", 320]]));

  assert.deepEqual(sections[0].groups, []);
  assert.deepEqual(sections[1].groups, [
    { day: 20, total: 320, pending: 320 },
  ]);
});
