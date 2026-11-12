import { updateAccountValue } from "../../accounts/data/accountService";
import { deleteTransaction, updateTransaction } from "../../transactions/data/transactionService";
import { db } from "../../../lib/firestore";

export const dashboardPixRepository = {
  updateTransaction: (monthId: string, transactionId: string, data: Parameters<typeof updateTransaction>[2]) =>
    updateTransaction(monthId, transactionId, data, db),
  deleteTransaction: (monthId: string, transactionId: string) => deleteTransaction(monthId, transactionId, db),
  updateAccountValue: (monthId: string, accountId: string, value: number) =>
    updateAccountValue(monthId, accountId, value, db),
};
