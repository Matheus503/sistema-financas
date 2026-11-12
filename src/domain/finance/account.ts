import { isCreditCardAccount } from "./accountBalance";

export type AccountType = "CREDIT" | "FIXED" | "VARIABLE" | string;

export type FinanceAccount = {
  id: string;
  name: string;
  type: AccountType;
  value?: number;
  expectedValue?: number;
  isPaid?: boolean;
  paidOn?: string;
  order?: number;
  dia_vencimento?: number;
  dia_fechamento?: number;
  isCreditCard?: boolean;
  creditCardKey?: string;
  isArchived?: boolean;
  isPrimaryCreditCard?: boolean;
  installmentBaseName?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  installmentGroupId?: string;
};

export function formatAccountNameWithDueDay(
  account: Pick<FinanceAccount, "name" | "dia_vencimento">,
) {
  if (!account.dia_vencimento) return account.name;
  return `${account.name} - ${account.dia_vencimento}`;
}

const normalizeAccountName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type ClosingDayAccount = Pick<FinanceAccount, "name" | "dia_fechamento" | "dia_vencimento">;

export function getCreditCardClosingDay(account: ClosingDayAccount | null | undefined) {
  const closingDay = Number(account?.dia_fechamento);
  if (Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31) return closingDay;
  if (normalizeAccountName(String(account?.name || "")).includes("nubank")) return 12;
  const dueDay = Number(account?.dia_vencimento);
  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : 1;
}

export function getAccountClosingDay(account: ClosingDayAccount | null | undefined) {
  const closingDay = Number(account?.dia_fechamento);
  if (Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31) return closingDay;
  const normalizedName = normalizeAccountName(String(account?.name || ""));
  if (normalizedName.includes("nubank") || normalizedName === "pix") return 12;
  const dueDay = Number(account?.dia_vencimento);
  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : 1;
}

export const isPixAccount = (
  account: Pick<FinanceAccount, "name"> | null | undefined,
) => normalizeAccountName(String(account?.name || "").trim()) === "pix";

export const isCalculatedAccount = (
  account: Pick<FinanceAccount, "name" | "isCreditCard"> | null | undefined,
) => isCreditCardAccount(account) || isPixAccount(account);

export const isInstallmentAccount = (
  account: Pick<FinanceAccount, "installmentGroupId"> | null | undefined,
) => Boolean(account?.installmentGroupId);

export { isCreditCardAccount };
