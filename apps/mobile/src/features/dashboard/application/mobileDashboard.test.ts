import assert from "node:assert/strict";
import test from "node:test";
import {
  createMobileDashboardAccount,
  createMobileDashboardTransaction,
  deleteMobileDashboardAccount,
  deleteMobileDashboardTransaction,
  editMobileDashboardTransaction,
  updateMobileDashboardAccount,
} from "./mobileDashboard";

test("creates a named account with the next order and unpaid status", async () => {
  let created: Record<string, unknown> | null = null;
  const result = await createMobileDashboardAccount({
    async createAccount(_monthId, data) {
      created = data;
      return { id: "new-account", ...data };
    },
  }, "2026-11", [
    { id: "one", name: "Aluguel", type: "FIXED", order: 1 },
    { id: "two", name: "Energia", type: "VARIABLE", order: 4 },
  ], { name: " Internet ", type: "FIXED", value: 150, dueDay: 10 });

  assert.equal(result.name, "Internet");
  assert.equal(created?.order, 2);
  assert.equal(created?.isPaid, false);
  assert.equal(created?.value, 150);
});

test("creates credit cards with zero opening balance and requires a closing day", async () => {
  let created: Record<string, unknown> | null = null;
  const repository = {
    async createAccount(_monthId: string, data: Record<string, unknown>) {
      created = data;
      return { id: "card", ...data } as never;
    },
  };
  const account = await createMobileDashboardAccount(repository, "2026-11", [], {
    name: "Cartão", type: "VARIABLE", value: 850, closingDay: 12, isCreditCard: true,
  });
  assert.equal(account.value, 0);
  assert.equal(created?.isCreditCard, true);
  assert.equal(created?.dia_fechamento, 12);
  await assert.rejects(
    () => createMobileDashboardAccount(repository, "2026-11", [], {
      name: "Outro cartão", type: "VARIABLE", value: 0, isCreditCard: true,
    }),
    /dia de fechamento/,
  );
});

test("rejects invalid due days and blank names", async () => {
  const repository = { async createAccount() { throw new Error("Must not create"); } };
  await assert.rejects(
    () => createMobileDashboardAccount(repository, "month", [], { name: "Conta", type: "FIXED", value: 0, dueDay: 32 }),
    /dia de vencimento/,
  );
  await assert.rejects(
    () => createMobileDashboardAccount(repository, "month", [], { name: "  ", type: "FIXED", value: 0 }),
    /nome da conta/,
  );
});

test("updates common account details and normalizes its name", async () => {
  let updated: { name: string; value: number; dueDay?: number } | null = null;
  await updateMobileDashboardAccount({
    async updateAccountDetails(_monthId, _accountId, data) { updated = data; },
  }, "2026-11", { id: "rent", name: "Aluguel", type: "FIXED", value: 1200 }, {
    name: "  Aluguel atualizado ", value: 1350, dueDay: 5,
  });
  assert.deepEqual(updated, { name: "Aluguel atualizado", value: 1350, dueDay: 5 });
});

test("updates special card settings through the special-account repository method", async () => {
  let updated: Record<string, unknown> | null = null;
  const repository = {
    async updateAccountDetails() { throw new Error("Must not update a card through the common-account method"); },
    async updateSpecialAccountDetails(_monthId: string, _accountId: string, data: Record<string, unknown>) { updated = data; },
  };
  await updateMobileDashboardAccount(repository, "month", { id: "card", name: "Cartão", type: "VARIABLE", isCreditCard: true }, {
    name: "Cartão atualizado", value: 0, closingDay: 12,
  });
  assert.deepEqual(updated, {
    name: "Cartão atualizado", value: 0, dia_vencimento: undefined, dia_fechamento: 12,
    isArchived: undefined, isPrimaryCreditCard: undefined,
  });
});

test("rejects invalid common account values", async () => {
  const repository = { async updateAccountDetails() { throw new Error("Must not update"); } };
  await assert.rejects(
    () => updateMobileDashboardAccount(repository, "month", { id: "rent", name: "Aluguel", type: "FIXED" }, { name: "Aluguel", value: -1 }),
    /valor inicial válido/,
  );
});

test("deletes common accounts through the repository and rejects special accounts", async () => {
  let deleted: string | null = null;
  const repository = { async deleteAccount(_monthId: string, accountId: string) { deleted = accountId; } };
  await deleteMobileDashboardAccount(repository, "2026-11", "group", { id: "rent", name: "Aluguel", type: "FIXED" });
  assert.equal(deleted, "rent");
  await assert.rejects(
    () => deleteMobileDashboardAccount(repository, "2026-11", "group", { id: "card", name: "Cartão", type: "VARIABLE", isCreditCard: true }),
    /contas protegidas/,
  );
});

test("edits and deletes non-card transaction values together with their account totals", async () => {
  const account = { id: "energy", name: "Energia", type: "VARIABLE", value: 100 } as const;
  const transaction = { id: "entry", accountId: "energy", value: 20 } as const;
  const calls: unknown[][] = [];
  const repository = {
    async updateAccountValue(...args: unknown[]) { calls.push(["account", ...args]); },
    async updateTransaction(...args: unknown[]) { calls.push(["transaction", ...args]); },
    async deleteTransaction(...args: unknown[]) { calls.push(["delete", ...args]); },
    async cancelInstallment() { throw new Error("Must not cancel a regular transaction"); },
  };

  await editMobileDashboardTransaction(repository, "2026-11", [account], transaction, 25);
  await deleteMobileDashboardTransaction(repository, "2026-11", "group", [account], transaction);

  assert.deepEqual(calls, [
    ["account", "2026-11", "energy", 105],
    ["transaction", "2026-11", "entry", { value: 25 }],
    ["account", "2026-11", "energy", 80],
    ["delete", "2026-11", "entry"],
  ]);
});

test("rejects editing one installment while cancellation removes the current and future series", async () => {
  const installment = {
    id: "entry-installment-2",
    accountId: "card",
    value: 25,
    installmentGroupId: "purchase-1",
    installmentCurrent: 2,
    installmentTotal: 4,
  } as const;
  const calls: unknown[][] = [];
  const repository = {
    async updateTransaction(...args: unknown[]) { calls.push(["edit", ...args]); },
    async updateAccountValue(...args: unknown[]) { calls.push(["balance", ...args]); },
    async deleteTransaction(...args: unknown[]) { calls.push(["delete", ...args]); },
    async cancelInstallment(data: unknown) { calls.push(["cancel", data]); },
  };

  await assert.rejects(
    () => editMobileDashboardTransaction(repository, "2026-11", [], installment, 30),
    /compra parcelada/,
  );
  await deleteMobileDashboardTransaction(repository, "2026-11", "group-1", [], installment);
  assert.deepEqual(calls, [["cancel", {
    groupId: "group-1",
    currentMonthId: "2026-11",
    installmentGroupId: "purchase-1",
    currentInstallment: 2,
  }]]);
});

test("routes a card purchase to its invoice month without changing the card opening value", async () => {
  const calls: unknown[][] = [];
  const card = {
    id: "card-key",
    name: "Cartão principal",
    type: "VARIABLE",
    isCreditCard: true,
    creditCardKey: "card-key",
    dia_fechamento: 12,
  } as const;
  const repository = {
    async getMonthData() { return { accounts: [card], transactions: [] }; },
    async createMonth() { throw new Error("No additional month should be created"); },
    async createAccount() { throw new Error("Existing card should be reused"); },
    async updateAccountValue(...args: unknown[]) { calls.push(["account-value", ...args]); },
    async addTransaction(monthId: string, data: Record<string, unknown>) {
      calls.push(["transaction", monthId, data]);
      return { id: "purchase", ...data } as never;
    },
    async createInstallmentPurchase(data: unknown) { calls.push(["purchase-series", data]); },
  };

  const result = await createMobileDashboardTransaction(repository, {
    monthId: "nov-2026",
    months: [{ id: "nov-2026", year: 2026, month: 11 }],
    accounts: [card],
    groupId: "group-1",
    userId: "user-1",
    userName: "Matheus",
    accountId: "card-key",
    value: 25.5,
    date: "2026-11-01",
    category: "Mercado",
    note: "Compra à vista",
    installments: 1,
  });

  assert.equal(result.targetMonthId, "nov-2026");
  assert.equal(calls.length, 1);
  assert.equal((calls[0][2] as Record<string, unknown>).value, 25.5);
});

test("records first installment and exact remaining cents for a card purchase series", async () => {
  const calls: unknown[][] = [];
  const card = {
    id: "card-key",
    name: "Cartão principal",
    type: "VARIABLE",
    isCreditCard: true,
    creditCardKey: "card-key",
    dia_fechamento: 12,
  } as const;
  const repository = {
    async getMonthData() { return { accounts: [card], transactions: [] }; },
    async createMonth() { throw new Error("No additional month should be created here"); },
    async createAccount() { throw new Error("Existing card should be reused"); },
    async updateAccountValue(...args: unknown[]) { calls.push(["account-value", ...args]); },
    async addTransaction(monthId: string, data: Record<string, unknown>) {
      calls.push(["transaction", monthId, data]);
      return { id: "installment-1", ...data } as never;
    },
    async createInstallmentPurchase(data: Record<string, unknown>) { calls.push(["purchase-series", data]); },
  };

  const result = await createMobileDashboardTransaction(repository, {
    monthId: "nov-2026",
    months: [{ id: "nov-2026", year: 2026, month: 11 }],
    accounts: [card],
    groupId: "group-1",
    userId: "user-1",
    userName: "Matheus",
    accountId: "card-key",
    value: 100,
    date: "2026-11-01",
    category: "Eletrônicos",
    note: "Fone",
    installments: 3,
  });

  assert.equal(result.targetMonthId, "nov-2026");
  assert.equal(calls.length, 2);
  assert.equal((calls[0][2] as Record<string, unknown>).value, 33.34);
  assert.deepEqual((calls[1][1] as Record<string, unknown>).installmentValuesCents, [3333, 3333]);
  assert.equal((calls[1][1] as Record<string, unknown>).firstInstallmentNumber, 2);
});
