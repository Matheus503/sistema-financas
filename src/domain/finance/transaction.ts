export type FinanceTransaction = {
  id: string;
  accountId?: string;
  value?: number;
  date?: string;
  category?: string;
  note?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  launcherId?: string;
  launcherName?: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
};

export type AddTransactionPayload = {
  value: number;
  accountId: string;
  category: string;
  note: string;
  userId: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  date: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
};
