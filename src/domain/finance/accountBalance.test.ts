import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionTotalsByAccount,
  calculateAccountBalance,
  calculateDashboardRealBalance,
  getAccountBalanceValue,
  isCreditCardAccount,
} from "./accountBalance";

test("adds card transactions to the account value and leaves other accounts unchanged", () => {
  const totals = buildTransactionTotalsByAccount([
    { accountId: "card", value: 150 },
    { accountId: "card", value: 25.5 },
    { accountId: "pix", value: 80 },
  ]);

  assert.equal(getAccountBalanceValue({ id: "card", name: "Cartão", type: "VARIABLE", value: 20, isCreditCard: true }, totals), 195.5);
  assert.equal(getAccountBalanceValue({ id: "pix", name: "PIX", type: "VARIABLE", value: 80 }, totals), 80);
});

test("preserves card recognition by flag and Nubank name", () => {
  assert.equal(isCreditCardAccount({ name: "Outro cartão", isCreditCard: true }), true);
  assert.equal(isCreditCardAccount({ name: "Cartão de crédito Nubank" }), true);
  assert.equal(isCreditCardAccount({ name: "Conta corrente" }), false);
});

test("calculates dashboard real balance as credits minus every non-credit account", () => {
  const totals = buildTransactionTotalsByAccount([{ accountId: "card", value: 100 }]);
  const accounts = [
    { id: "salary", name: "Salário", type: "CREDIT", value: 5000 },
    { id: "fixed", name: "Aluguel", type: "FIXED", value: 1500 },
    { id: "card", name: "Cartão", type: "VARIABLE", value: 0, isCreditCard: true },
  ];

  assert.equal(calculateAccountBalance(accounts, totals), 3400);
});

test("subtracts investment impact and goal contributions from dashboard balance", () => {
  assert.equal(calculateDashboardRealBalance(3400, 12_500, 7_500), 3200);
  assert.equal(calculateDashboardRealBalance(3400, -5_000, 0), 3450);
});
