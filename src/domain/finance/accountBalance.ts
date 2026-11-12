export type BalanceAccount = {
  id: string;
  name?: string;
  type: string;
  value?: number;
  isCreditCard?: boolean;
};

export type BalanceTransaction = {
  accountId?: string;
  value?: number;
};

const normalizeAccountName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isCreditCardAccount(
  account: Pick<BalanceAccount, "name" | "isCreditCard"> | null | undefined,
) {
  if (account?.isCreditCard) return true;

  const normalizedName = normalizeAccountName(String(account?.name || ""));
  return normalizedName.includes("nubank")
    && normalizedName.includes("cartao")
    && (normalizedName.includes("credito") || normalizedName.includes("cred"));
}

export function buildTransactionTotalsByAccount(transactions: BalanceTransaction[]) {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (!transaction?.accountId) continue;
    const accountId = String(transaction.accountId);
    totals.set(accountId, (totals.get(accountId) || 0) + Number(transaction.value || 0));
  }

  return totals;
}

export function getAccountBalanceValue(
  account: BalanceAccount,
  transactionTotals: ReadonlyMap<string, number>,
) {
  const baseValue = Number(account?.value || 0);
  if (!isCreditCardAccount(account)) return baseValue;
  return baseValue + (transactionTotals.get(String(account.id)) || 0);
}

export function calculateAccountBalance(
  accounts: BalanceAccount[],
  transactionTotals: ReadonlyMap<string, number>,
) {
  const credits = accounts
    .filter(account => account.type === "CREDIT")
    .reduce((sum, account) => sum + getAccountBalanceValue(account, transactionTotals), 0);
  const expenses = accounts
    .filter(account => account.type !== "CREDIT")
    .reduce((sum, account) => sum + getAccountBalanceValue(account, transactionTotals), 0);

  return credits - expenses;
}

export function calculateDashboardRealBalance(
  accountBalance: number,
  investmentImpactCents: number,
  goalContributionCents: number,
) {
  return accountBalance - investmentImpactCents / 100 - goalContributionCents / 100;
}
