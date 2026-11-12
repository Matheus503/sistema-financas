import type { FinanceAccount } from "../../../domain/finance/account";
import type { StatementTransaction } from "../../../domain/finance/expenseStatement";
import {
  getWebAccountsForUnclassifiedEntries as loadAccounts,
  linkWebExpenseStatementEntry,
} from "../data/webExpenseStatementRepository";

export function getAccountsForUnclassifiedEntries(monthIds: string[]) {
  return loadAccounts(monthIds);
}

export function linkUnclassifiedExpenseEntry(monthId: string, transactionId: string, accountId: string) {
  return linkWebExpenseStatementEntry(monthId, transactionId, accountId);
}

export function getEntryAccountOptions(accounts: FinanceAccount[]) {
  return accounts.filter((account) => account.type === "CREDIT"
    || account.type === "FIXED"
    || account.type === "VARIABLE");
}

export function getUnclassifiedEntryKey(entry: Pick<StatementTransaction, "monthId" | "id">) {
  return `${entry.monthId}/${entry.id}`;
}
