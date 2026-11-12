"use client";

import { useCallback, useMemo, useState } from "react";
import type { FinanceAccount } from "../../../../domain/finance/account";
import { loadDashboardMonth, toggleDashboardAccountPaid } from "../../application/dashboardFinance";
import type { FinanceTransaction } from "../../../../domain/finance/transaction";
import {
  buildTransactionTotalsByAccount,
  calculateAccountBalance,
  getAccountBalanceValue,
} from "../../../../domain/finance/accountBalance";

export function useDashboardFinance() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  const loadData = useCallback(async (monthId: string) => {
    const data = await loadDashboardMonth(monthId);
    setAccounts(data.accounts);
    setTransactions(data.transactions);
  }, []);

  const transactionTotalsByAccount = useMemo(() => {
    return buildTransactionTotalsByAccount(transactions);
  }, [transactions]);

  const handleTogglePaid = async (monthId: string, acc: FinanceAccount) => {
    await toggleDashboardAccountPaid(monthId, acc.id, !!acc.isPaid);

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === acc.id ? { ...item, isPaid: !item.isPaid } : item
      )
    );
  };
  const getAccountValue = useCallback((acc: FinanceAccount) => {
    return getAccountBalanceValue(acc, transactionTotalsByAccount);
  }, [transactionTotalsByAccount]);

  const saldo = useMemo(() => {
    return calculateAccountBalance(accounts, transactionTotalsByAccount);
  }, [accounts, transactionTotalsByAccount]);

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
