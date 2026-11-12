import {
  getAccountsByMonth,
  toggleAccountPaid,
} from "../../accounts/data/accountService";
import type { FinanceAccount } from "../../../domain/finance/account";
import { db } from "../../../lib/firestore";
import { getTransactions } from "../../transactions/data/transactionService";
import type { FinanceTransaction } from "../../../domain/finance/transaction";

export async function getDashboardMonthData(monthId: string) {
  const [accounts, transactions] = await Promise.all([
    getAccountsByMonth(monthId, db),
    getTransactions(monthId, db),
  ]);

  return {
    accounts: accounts as FinanceAccount[],
    transactions: transactions as FinanceTransaction[],
  };
}

export function setDashboardAccountPaid(
  monthId: string,
  accountId: string,
  isPaid: boolean,
) {
  return toggleAccountPaid(monthId, accountId, isPaid, db);
}
