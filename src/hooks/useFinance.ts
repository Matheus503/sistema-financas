"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type FinanceAccount,
  getAccountsByMonth,
  isCreditCardAccount,
  toggleAccountPaid,
} from "../services/accountService";
import { getTransactions } from "../services/transactionService";

type FinanceTransaction = {
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
};

export function useFinance() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  const loadData = async (monthId: string) => {
    const [accs, trans] = await Promise.all([
      getAccountsByMonth(monthId),
      getTransactions(monthId),
    ]);

    setAccounts(accs as FinanceAccount[]);
    setTransactions(trans as FinanceTransaction[]);
  };

  const transactionTotalsByAccount = useMemo(() => {
    const totals = new Map<string, number>();

    for (const transaction of transactions) {
      if (!transaction?.accountId) continue;

      const accountId = String(transaction.accountId);
      totals.set(
        accountId,
        (totals.get(accountId) || 0) + Number(transaction.value || 0)
      );
    }

    return totals;
  }, [transactions]);

  const handleTogglePaid = async (monthId: string, acc: FinanceAccount) => {
    await toggleAccountPaid(monthId, acc.id, !!acc.isPaid);

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === acc.id ? { ...item, isPaid: !item.isPaid } : item
      )
    );
  };
  const getAccountValue = useCallback((acc: FinanceAccount) => {
    const baseValue = Number(acc?.value || 0);

    if (!isCreditCardAccount(acc)) {
      return baseValue;
    }

    const totalTransactions = transactionTotalsByAccount.get(String(acc.id)) || 0;

    return baseValue + totalTransactions;
  }, [transactionTotalsByAccount]);

  const saldo = useMemo(() => {
    const credits = accounts
      .filter((a) => a.type === "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

    const expenses = accounts
      .filter((a) => a.type !== "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

    return credits - expenses;
  }, [accounts, getAccountValue]);

  return {
    accounts,
    setAccounts,
    transactions,
    setTransactions,
    loadData,
    handleTogglePaid,
    getAccountValue,
    saldo,
  };
}
