"use client";

import { useMemo, useState } from "react";
import {
  getAccountsByMonth,
  toggleAccountPaid,
} from "../services/accountService";
import { getTransactions } from "../services/transactionService";

export function useFinance() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadData = async (monthId: string) => {
    const [accs, trans] = await Promise.all([
      getAccountsByMonth(monthId),
      getTransactions(monthId),
    ]);

    setAccounts(accs);
    setTransactions(trans);
  };

  const handleTogglePaid = async (monthId: string, acc: any) => {
    await toggleAccountPaid(monthId, acc.id, !!acc.isPaid);

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === acc.id ? { ...item, isPaid: !item.isPaid } : item
      )
    );
  };
const getAccountValue = (acc: any) => {
  const baseValue = Number(acc?.value || 0);

  const totalTransactions = transactions
    .filter((t) => t.accountId === acc.id)
    .reduce((sum, t) => sum + Number(t.value || 0), 0);

  return baseValue + totalTransactions;
};

  const saldo = useMemo(() => {
    const credits = accounts
      .filter((a) => a.type === "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

    const expenses = accounts
      .filter((a) => a.type !== "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

    return credits - expenses;
  }, [accounts]);

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