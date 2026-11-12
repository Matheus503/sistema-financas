import type { FinanceMonth } from "../../../../../../src/domain/finance/month";
import type { FinanceCategory } from "../../../../../../src/domain/finance/category";
import type {
  MobileDashboardAdjustments,
  MobileDashboardMonthData,
} from "../contracts";
import type { FinanceAccount } from "../../../../../../src/domain/finance/account";
import { getAccountClosingDay, getCreditCardClosingDay, isCreditCardAccount, isInstallmentAccount, isPixAccount } from "../../../../../../src/domain/finance/account";
import type { FinanceTransaction } from "../../../../../../src/domain/finance/transaction";
import { mapMonthlyReportSource, type MonthlyReportSourceData } from "../../../../../../src/domain/finance/monthlyReport";
import {
  buildInstallmentSchedule,
  getCreditCardKey,
  getInvoiceMonth,
  matchesSelectedCreditCard,
  validateInvoiceMonthRange,
} from "../../../../../../src/domain/finance/installment";
import type { CreateInstallmentPurchaseData } from "../../../../../../src/domain/finance/installment";
import type { AddTransactionPayload } from "../../../../../../src/domain/finance/transaction";
import { isCreditCardAccount as isCardBalanceAccount } from "../../../../../../src/domain/finance/accountBalance";
import {
  buildTransactionTotalsByAccount,
  calculateAccountBalance,
  calculateDashboardRealBalance,
  getAccountBalanceValue,
} from "../../../../../../src/domain/finance/accountBalance";

export type MobileDashboardRepository = {
  getMonths(groupId: string): Promise<FinanceMonth[]>;
  getCategories(groupId: string): Promise<FinanceCategory[]>;
  getMonthAdjustments(
    groupId: string,
    months: FinanceMonth[],
  ): Promise<Record<string, MobileDashboardAdjustments>>;
  getMonthData(monthId: string): Promise<MobileDashboardMonthData>;
  getMonthlyReportSource(groupId: string): Promise<MonthlyReportSourceData>;
  createMonth(year: number, month: number, userId: string, groupId: string): Promise<string>;
  toggleAccountPaid(monthId: string, accountId: string, current: boolean): Promise<void>;
  createAccount(monthId: string, data: Omit<FinanceAccount, "id">): Promise<FinanceAccount>;
  updateAccountValue(monthId: string, accountId: string, value: number): Promise<void>;
  addTransaction(monthId: string, data: AddTransactionPayload): Promise<FinanceTransaction>;
  updateTransaction(monthId: string, transactionId: string, data: { value?: number; category?: string; note?: string; date?: string }): Promise<void>;
  deleteTransaction(monthId: string, transactionId: string): Promise<void>;
  cancelInstallment(data: { groupId: string; currentMonthId: string; installmentGroupId: string; currentInstallment: number }): Promise<void>;
  createInstallmentPurchase(data: CreateInstallmentPurchaseData): Promise<void>;
  updateAccountDetails(monthId: string, accountId: string, data: MobileCommonAccountUpdate): Promise<void>;
  updateSpecialAccountDetails(monthId: string, accountId: string, data: { name: string; value?: number; dia_vencimento?: number; dia_fechamento?: number; isArchived?: boolean; isPrimaryCreditCard?: boolean }): Promise<unknown>;
  deleteAccount(monthId: string, accountId: string): Promise<void>;
  deleteInstallmentAccount(monthId: string, accountId: string): Promise<void>;
};

export type MobileCommonAccountUpdate = { name: string; value?: number; dueDay?: number; closingDay?: number; isArchived?: boolean; isPrimaryCreditCard?: boolean };

export type MobileAccountCreationInput = {
  name: string;
  type: MobileAccountType;
  value: number;
  dueDay?: number;
  closingDay?: number;
  isCreditCard?: boolean;
};

export type MobileAccountType = "CREDIT" | "FIXED" | "VARIABLE";

export type MobileLaunchInput = {
  monthId: string;
  months: FinanceMonth[];
  accounts: FinanceAccount[];
  groupId: string;
  userId: string;
  userName: string;
  accountId: string;
  value: number;
  date: string;
  category: string;
  note: string;
  installments: number;
};

export async function editMobileDashboardTransaction(
  repository: Pick<MobileDashboardRepository, "updateTransaction" | "updateAccountValue">,
  monthId: string,
  accounts: FinanceAccount[],
  transaction: FinanceTransaction,
  value: number,
) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Informe um valor válido.");
  if (transaction.installmentGroupId && transaction.installmentCurrent) {
    throw new Error("Não é possível editar individualmente uma parcela de compra parcelada.");
  }
  const previousValue = Number(transaction.value || 0);
  const account = accounts.find((item) => item.id === transaction.accountId);
  if (account && !isCardBalanceAccount(account)) {
    await repository.updateAccountValue(monthId, account.id, Math.round((Number(account.value || 0) + value - previousValue) * 100) / 100);
  }
  await repository.updateTransaction(monthId, transaction.id, { value });
}

export async function deleteMobileDashboardTransaction(
  repository: Pick<MobileDashboardRepository, "deleteTransaction" | "updateAccountValue" | "cancelInstallment">,
  monthId: string,
  groupId: string,
  accounts: FinanceAccount[],
  transaction: FinanceTransaction,
) {
  if (transaction.installmentGroupId && transaction.installmentCurrent) {
    await repository.cancelInstallment({
      groupId,
      currentMonthId: monthId,
      installmentGroupId: String(transaction.installmentGroupId),
      currentInstallment: Number(transaction.installmentCurrent),
    });
    return;
  }
  const account = accounts.find((item) => item.id === transaction.accountId);
  if (account && !isCardBalanceAccount(account)) {
    await repository.updateAccountValue(monthId, account.id, Math.round((Number(account.value || 0) - Number(transaction.value || 0)) * 100) / 100);
  }
  await repository.deleteTransaction(monthId, transaction.id);
}

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const getTodayDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getInstallmentGroupId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function createMobileDashboardTransaction(
  repository: Pick<MobileDashboardRepository, "getMonthData" | "createMonth" | "createAccount" | "updateAccountValue" | "addTransaction" | "createInstallmentPurchase">,
  input: MobileLaunchInput,
) {
  const valueCents = Math.round(input.value * 100);
  if (!Number.isFinite(valueCents) || valueCents <= 0) throw new Error("Informe um valor maior que zero.");
  if (!isIsoDate(input.date)) throw new Error("Informe uma data válida.");
  const selectedAccount = input.accounts.find((account) => account.id === input.accountId);
  if (!selectedAccount || selectedAccount.type !== "VARIABLE") throw new Error("Selecione uma conta variável.");

  const isCard = isCreditCardAccount(selectedAccount);
  const isPix = isPixAccount(selectedAccount);
  if ((isCard || isPix) && !input.category.trim()) throw new Error("Selecione uma categoria.");
  if (isCard && (!Number.isInteger(input.installments) || input.installments < 1 || input.installments > 60)) {
    throw new Error("Informe entre 1 e 60 parcelas.");
  }

  const selectedMonth = input.months.find((month) => month.id === input.monthId);
  if (!selectedMonth) throw new Error("O mês selecionado não está disponível. Atualize o app e tente novamente.");
  let months = input.months;
  const monthForInvoice = (invoice: { year: number; month: number }) =>
    months.find((month) => month.year === invoice.year && month.month === invoice.month);
  const ensureMonth = async (invoice: { year: number; month: number }) => {
    const existing = monthForInvoice(invoice);
    if (existing) return existing;
    const id = await repository.createMonth(invoice.year, invoice.month, input.userId, input.groupId);
    const created = { id, year: invoice.year, month: invoice.month } as FinanceMonth;
    months = [...months, created].sort((a, b) => a.year - b.year || a.month - b.month);
    return created;
  };
  const ensureTargetAccount = async (monthId: string) => {
    const targetAccounts = monthId === input.monthId ? input.accounts : (await repository.getMonthData(monthId)).accounts;
    const existing = isPix
      ? targetAccounts.find((account) => isPixAccount(account))
      : targetAccounts.find((account) => matchesSelectedCreditCard(account, selectedAccount));
    if (existing) return { account: existing, accounts: targetAccounts };
    const sameTypeAccounts = targetAccounts.filter((account) => account.type === selectedAccount.type);
    const order = sameTypeAccounts.length
      ? Math.max(...sameTypeAccounts.map((account, index) => Number.isFinite(Number(account.order)) ? Number(account.order) : index)) + 1
      : 0;
    const created = await repository.createAccount(monthId, {
      name: selectedAccount.name,
      type: selectedAccount.type,
      value: 0,
      ...(selectedAccount.dia_vencimento ? { dia_vencimento: selectedAccount.dia_vencimento } : {}),
      dia_fechamento: isPix ? getAccountClosingDay(selectedAccount) : getCreditCardClosingDay(selectedAccount),
      ...(isPix ? {} : { isCreditCard: true, creditCardKey: getCreditCardKey(selectedAccount), isPrimaryCreditCard: selectedAccount.isPrimaryCreditCard === true }),
      isPaid: false,
      order,
    });
    return { account: created, accounts: [...targetAccounts, created] };
  };
  const userName = input.userName.trim();
  const launcherName = userName.split("@")[0].split(" ")[0];
  const basePayload = {
    category: isCard || isPix ? input.category.trim() : "",
    note: input.note.trim(),
    userId: input.userId,
    userName,
    launcherId: input.userId,
    launcherName,
    date: input.date,
  };

  if (isCard || isPix) {
    const closingDay = isPix ? getAccountClosingDay(selectedAccount) : getCreditCardClosingDay(selectedAccount);
    const invoiceMonth = getInvoiceMonth(input.date, closingDay);
    const currentInvoiceMonth = getInvoiceMonth(getTodayDateKey(), closingDay);
    const reference = selectedMonth.year && selectedMonth.month ? selectedMonth : currentInvoiceMonth;
    const invoiceRange = validateInvoiceMonthRange(input.date, closingDay, reference);
    if (!invoiceRange.isWithinAllowedRange) {
      throw new Error(`A data deve gerar uma fatura até ${String(invoiceRange.nextInvoiceMonth.month).padStart(2, "0")}/${invoiceRange.nextInvoiceMonth.year}.`);
    }

    if (isCard && input.installments > 1) {
      if (selectedAccount.isArchived === true) throw new Error("Este cartão está arquivado e não aceita lançamentos parcelados.");
      const schedule = buildInstallmentSchedule(input.date, closingDay, valueCents / 100, input.installments, input.note);
      const firstMonth = await ensureMonth(schedule.firstInvoiceMonth);
      const firstAccount = await ensureTargetAccount(firstMonth.id);
      const installmentGroupId = getInstallmentGroupId();
      const firstInstallment = schedule.installments[0];
      const created = await repository.addTransaction(firstMonth.id, {
        ...basePayload,
        accountId: firstAccount.account.id,
        value: firstInstallment.valueCents / 100,
        note: firstInstallment.note,
        installmentGroupId,
        installmentCurrent: 1,
        installmentTotal: input.installments,
      });
      for (const installment of schedule.installments.slice(1)) {
        const existingMonth = monthForInvoice(installment);
        if (!existingMonth) continue;
        const target = await ensureTargetAccount(existingMonth.id);
        await repository.addTransaction(existingMonth.id, {
          ...basePayload,
          accountId: target.account.id,
          value: installment.valueCents / 100,
          note: installment.note,
          installmentGroupId,
          installmentCurrent: installment.installmentNumber,
          installmentTotal: input.installments,
        });
      }
      await repository.createInstallmentPurchase({
        groupId: input.groupId,
        creditCardKey: getCreditCardKey(selectedAccount),
        cardName: selectedAccount.name,
        dia_vencimento: selectedAccount.dia_vencimento,
        dia_fechamento: closingDay,
        category: input.category.trim(),
        note: input.note.trim(),
        purchaseDate: input.date,
        firstYear: schedule.nextInvoiceMonth.year,
        firstMonth: schedule.nextInvoiceMonth.month,
        firstInstallmentNumber: 2,
        totalPurchaseInstallments: input.installments,
        installmentValuesCents: schedule.installments.slice(1).map((item) => item.valueCents),
        userId: input.userId,
        userName,
        launcherId: input.userId,
        launcherName,
        installmentGroupId,
      });
      return { targetMonthId: firstMonth.id, months, transaction: created };
    }

    const targetMonth = await ensureMonth(invoiceMonth);
    if (selectedAccount.isArchived === true && targetMonth.id !== input.monthId && isCard) {
      throw new Error("Este cartão está arquivado e não aceita lançamentos em faturas futuras.");
    }
    const target = await ensureTargetAccount(targetMonth.id);
    const created = await repository.addTransaction(targetMonth.id, {
      ...basePayload,
      accountId: target.account.id,
      value: valueCents / 100,
    });
    if (!isCard) {
      await repository.updateAccountValue(targetMonth.id, target.account.id, Number(target.account.value || 0) + valueCents / 100);
    }
    return { targetMonthId: targetMonth.id, months, transaction: created };
  }

  const created = await repository.addTransaction(input.monthId, {
    ...basePayload,
    accountId: selectedAccount.id,
    value: valueCents / 100,
  });
  await repository.updateAccountValue(input.monthId, selectedAccount.id, Number(selectedAccount.value || 0) + valueCents / 100);
  return { targetMonthId: input.monthId, months, transaction: created };
}

export async function deleteMobileDashboardAccount(
  repository: Pick<MobileDashboardRepository, "deleteAccount" | "deleteInstallmentAccount" | "cancelInstallment">,
  monthId: string,
  groupId: string,
  account: FinanceAccount,
) {
  if (isCreditCardAccount(account) || isPixAccount(account)) {
    throw new Error("Cartões e PIX são contas protegidas e não podem ser excluídos.");
  }
  if (isInstallmentAccount(account)) {
    if (groupId && account.installmentCurrent) {
      await repository.cancelInstallment({
        groupId,
        currentMonthId: monthId,
        installmentGroupId: String(account.installmentGroupId),
        currentInstallment: Number(account.installmentCurrent),
      });
    }
    await repository.deleteInstallmentAccount(monthId, account.id);
    return;
  }
  await repository.deleteAccount(monthId, account.id);
}

export async function updateMobileDashboardAccount(
  repository: Pick<MobileDashboardRepository, "updateAccountDetails" | "updateSpecialAccountDetails">,
  monthId: string,
  account: FinanceAccount,
  input: MobileCommonAccountUpdate,
) {
  if (isInstallmentAccount(account)) {
    throw new Error("As contas de parcelas futuras são atualizadas junto com a compra parcelada.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome da conta.");
  const isSpecial = isCreditCardAccount(account) || isPixAccount(account);
  if (input.value !== undefined && (!Number.isFinite(input.value) || input.value < 0)) throw new Error("Informe um valor inicial válido.");
  for (const [label, day] of [["vencimento", input.dueDay], ["fechamento", input.closingDay]] as const) {
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
      throw new Error(`Informe um dia de ${label} entre 1 e 31.`);
    }
  }
  if (isCreditCardAccount(account) && input.closingDay === undefined) throw new Error("Informe o dia de fechamento do cartão.");
  const details = {
    name,
    value: input.value ?? Number(account.value || 0),
    dueDay: input.dueDay,
    closingDay: input.closingDay,
    isArchived: input.isArchived,
    isPrimaryCreditCard: input.isPrimaryCreditCard,
  };
  if (isSpecial) {
    await repository.updateSpecialAccountDetails(monthId, account.id, {
      name,
      ...(input.value === undefined ? {} : { value: input.value }),
      dia_vencimento: input.dueDay,
      dia_fechamento: input.closingDay,
      isArchived: input.isArchived,
      isPrimaryCreditCard: input.isPrimaryCreditCard,
    });
    return;
  }
  await repository.updateAccountDetails(monthId, account.id, { name: details.name, value: details.value, dueDay: details.dueDay });
}

export async function loadMobileDashboardMonths(
  repository: MobileDashboardRepository,
  groupId: string,
) {
  const months = await repository.getMonths(groupId);
  const adjustments = await repository.getMonthAdjustments(groupId, months);

  return {
    months,
    adjustments,
    initialMonthId: months.at(-1)?.id || null,
  };
}

export function loadMobileDashboardMonthData(
  repository: MobileDashboardRepository,
  monthId: string,
) {
  return repository.getMonthData(monthId);
}

export async function loadMobileMonthlyReport(
  repository: Pick<MobileDashboardRepository, "getMonthlyReportSource">,
  groupId: string,
) {
  return mapMonthlyReportSource(await repository.getMonthlyReportSource(groupId));
}

export function toggleMobileDashboardAccountPaid(
  repository: MobileDashboardRepository,
  monthId: string,
  accountId: string,
  current: boolean,
) {
  return repository.toggleAccountPaid(monthId, accountId, current);
}

export async function createMobileDashboardAccount(
  repository: Pick<MobileDashboardRepository, "createAccount">,
  monthId: string,
  accounts: FinanceAccount[],
  input: MobileAccountCreationInput,
) {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome da conta.");
  if (!Number.isFinite(input.value)) throw new Error("Informe um valor inicial válido.");
  for (const [label, day] of [["vencimento", input.dueDay], ["fechamento", input.closingDay]] as const) {
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
      throw new Error(`Informe um dia de ${label} entre 1 e 31.`);
    }
  }
  if (input.isCreditCard && input.type !== "VARIABLE") {
    throw new Error("Cartão de crédito só pode ser cadastrado como conta variável.");
  }
  if (input.isCreditCard && input.closingDay === undefined) {
    throw new Error("Informe o dia de fechamento do cartão.");
  }

  const sameTypeAccounts = accounts.filter((account) => account.type === input.type);
  const order = sameTypeAccounts.length
    ? Math.max(...sameTypeAccounts.map((account, index) =>
        Number.isFinite(Number(account.order)) ? Number(account.order) : index,
      )) + 1
    : 0;

  return repository.createAccount(monthId, {
    name,
    type: input.type,
    value: input.isCreditCard ? 0 : input.value,
    dia_vencimento: input.dueDay,
    dia_fechamento: input.closingDay,
    isCreditCard: input.type === "VARIABLE" && input.isCreditCard === true,
    isPaid: false,
    order,
  });
}

export function summarizeMobileDashboardMonth(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[],
  adjustments: MobileDashboardAdjustments | undefined,
) {
  const transactionTotals = buildTransactionTotalsByAccount(transactions);
  const accountTotals = { CREDIT: 0, FIXED: 0, VARIABLE: 0 };

  for (const account of accounts) {
    const value = getAccountBalanceValue(account, transactionTotals);
    if (account.type === "CREDIT") accountTotals.CREDIT += value;
    else if (account.type === "FIXED") accountTotals.FIXED += value;
    else if (account.type === "VARIABLE") accountTotals.VARIABLE += value;
  }

  return {
    accountTotals,
    transactionTotals,
    realBalance: calculateDashboardRealBalance(
      calculateAccountBalance(accounts, transactionTotals),
      adjustments?.investmentImpactCents || 0,
      adjustments?.goalContributionCents || 0,
    ),
  };
}
