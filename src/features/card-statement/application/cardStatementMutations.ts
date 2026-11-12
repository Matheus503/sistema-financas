import {
  anticipateCardStatementInstallments,
  cancelCardStatementInstallments,
  removeCardStatementTransaction,
  saveCardStatementTransaction,
} from "./cardStatementCommands";

const stripInstallmentSuffix = (value: string) =>
  String(value || "")
    .replace(/\s*\(\d+\/\d+\)\s*$/, "")
    .replace(/\s-\s\d+\/\d+\s*$/, "")
    .trim();

export type SaveCardStatementEditInput = {
  monthId: string;
  transactionId: string;
  value: number;
  anticipation?: {
    groupId: string;
    installmentGroupId: string;
    currentInstallment: number;
    installmentsToAnticipate: number;
    originalAmount: number;
    paidAmount: number;
    discountAmount: number;
    accountId: string;
    category?: string;
    note?: string;
    date: string;
    userId: string;
    userName: string;
  };
};

export async function saveCardStatementEdit({
  monthId,
  transactionId,
  value,
  anticipation,
}: SaveCardStatementEditInput) {
  await saveCardStatementTransaction(monthId, transactionId, { value });

  if (!anticipation) return;

  await anticipateCardStatementInstallments({
    groupId: anticipation.groupId,
    currentMonthId: monthId,
    installmentGroupId: anticipation.installmentGroupId,
    currentInstallment: anticipation.currentInstallment,
    installmentsToAnticipate: anticipation.installmentsToAnticipate,
    originalAmount: anticipation.originalAmount,
    paidAmount: anticipation.paidAmount,
    discountAmount: anticipation.discountAmount,
    accountId: anticipation.accountId,
    category: anticipation.category || "Sem categoria",
    baseNote: stripInstallmentSuffix(anticipation.note || anticipation.category || ""),
    date: anticipation.date,
    userId: anticipation.userId,
    userName: anticipation.userName,
    launcherId: anticipation.userId,
    launcherName: anticipation.userName,
  });
}

export async function deleteCardStatementEntry(input: {
  groupId: string;
  monthId: string;
  transactionId: string;
  installmentGroupId?: string;
  currentInstallment?: number;
}) {
  const isInstallment = Boolean(
    input.groupId && input.installmentGroupId && input.currentInstallment,
  );

  if (isInstallment) {
    await cancelCardStatementInstallments({
      groupId: input.groupId,
      currentMonthId: input.monthId,
      installmentGroupId: input.installmentGroupId!,
      currentInstallment: input.currentInstallment!,
    });
  } else {
    await removeCardStatementTransaction(input.monthId, input.transactionId);
  }

  return { requiresReload: isInstallment };
}
