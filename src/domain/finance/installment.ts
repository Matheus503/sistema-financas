import {
  getCreditCardClosingDay,
  isCreditCardAccount,
  type FinanceAccount,
} from "./account";

export type InvoiceMonth = { year: number; month: number };
export type InstallmentScheduleItem = InvoiceMonth & {
  installmentNumber: number;
  valueCents: number;
  note: string;
};

export type InstallmentSchedule = {
  firstInvoiceMonth: InvoiceMonth;
  nextInvoiceMonth: InvoiceMonth;
  installments: InstallmentScheduleItem[];
};

export type CreateInstallmentPurchaseData = {
  groupId: string;
  creditCardKey: string;
  cardName: string;
  dia_vencimento?: number;
  dia_fechamento: number;
  category: string;
  note: string;
  purchaseDate: string;
  firstYear: number;
  firstMonth: number;
  firstInstallmentNumber: number;
  totalPurchaseInstallments: number;
  installmentValuesCents: number[];
  userId: string;
  userName: string;
  launcherId: string;
  launcherName: string;
  installmentGroupId: string;
};

export function getInvoiceMonth(dateKey: string, closingDay: number): InvoiceMonth {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (day >= closingDay) {
    return {
      year: month === 12 ? year + 1 : year,
      month: month === 12 ? 1 : month + 1,
    };
  }
  return { year, month };
}

export function addMonthsToInvoice(invoiceMonth: InvoiceMonth, offset: number): InvoiceMonth {
  const zeroBasedMonth = invoiceMonth.month - 1 + offset;
  return {
    year: invoiceMonth.year + Math.floor(zeroBasedMonth / 12),
    month: (zeroBasedMonth % 12) + 1,
  };
}

export function getMonthIndex(month: InvoiceMonth) {
  return month.year * 12 + month.month - 1;
}

export function validateInvoiceMonthRange(
  purchaseDate: string,
  closingDay: number,
  referenceInvoiceMonth: InvoiceMonth,
) {
  const invoiceMonth = getInvoiceMonth(purchaseDate, closingDay);
  const nextInvoiceMonth = addMonthsToInvoice(referenceInvoiceMonth, 1);
  const invoiceIndex = getMonthIndex(invoiceMonth);
  const referenceIndex = getMonthIndex(referenceInvoiceMonth);
  const nextInvoiceIndex = getMonthIndex(nextInvoiceMonth);

  return {
    invoiceMonth,
    nextInvoiceMonth,
    isWithinAllowedRange: invoiceIndex >= referenceIndex
      && invoiceIndex <= nextInvoiceIndex,
  };
}

export function splitCurrencyInCents(totalValue: number, installments: number) {
  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;
  return Array.from(
    { length: installments },
    (_, index) => baseCents + (index < remainder ? 1 : 0),
  );
}

export function buildInstallmentSchedule(
  purchaseDate: string,
  closingDay: number,
  totalValue: number,
  installmentCount: number,
  note: string,
): InstallmentSchedule {
  const firstInvoiceMonth = getInvoiceMonth(purchaseDate, closingDay);
  const values = splitCurrencyInCents(totalValue, installmentCount);
  const baseNote = note.trim();
  const installments = values.map((valueCents, index) => {
    const installmentNumber = index + 1;
    const invoiceMonth = addMonthsToInvoice(firstInvoiceMonth, index);
    return {
      ...invoiceMonth,
      installmentNumber,
      valueCents,
      note: baseNote
        ? `${baseNote} (${installmentNumber}/${installmentCount})`
        : `Parcela ${installmentNumber}/${installmentCount}`,
    };
  });

  return {
    firstInvoiceMonth,
    nextInvoiceMonth: addMonthsToInvoice(firstInvoiceMonth, 1),
    installments,
  };
}

export function getCreditCardKey(account: FinanceAccount) {
  return String(account.creditCardKey || account.id || "");
}

export function matchesSelectedCreditCard(account: FinanceAccount, selected: FinanceAccount) {
  if (!isCreditCardAccount(account)) return false;
  const selectedKey = getCreditCardKey(selected);
  const accountKey = getCreditCardKey(account);
  if (selectedKey && accountKey && selectedKey === accountKey) return true;

  return account.name === selected.name
    && Number(account.dia_vencimento || 0) === Number(selected.dia_vencimento || 0)
    && getCreditCardClosingDay(account) === getCreditCardClosingDay(selected);
}
