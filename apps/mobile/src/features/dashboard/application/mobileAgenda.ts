import { getAccountBalanceValue } from "../../../../../../src/domain/finance/accountBalance";
import { isPixAccount, type FinanceAccount } from "../../../../../../src/domain/finance/account";
import { groupAccountsByDay } from "../../../../../../src/domain/finance/accountSchedule";

export function buildMobileAgendaSections(
  accounts: FinanceAccount[],
  transactionTotals: Map<string, number>,
) {
  const scheduledAccounts = accounts.filter((account) => !isPixAccount(account));
  const sections = [
    {
      title: "Créditos por dia",
      isCredit: true,
      groups: groupAccountsByDay(
        scheduledAccounts.filter((account) => account.type === "CREDIT"),
        0,
      ),
    },
    {
      title: "Pagamentos · Fixas e variáveis",
      isCredit: false,
      groups: groupAccountsByDay(
        scheduledAccounts.filter((account) => account.type === "FIXED" || account.type === "VARIABLE"),
      ),
    },
  ];

  return sections.map((section) => ({
    title: section.title,
    isCredit: section.isCredit,
    groups: section.groups.map(({ day, accounts: groupedAccounts }) => {
      const total = groupedAccounts.reduce(
        (sum, account) => sum + getAccountBalanceValue(account, transactionTotals),
        0,
      );
      const pending = groupedAccounts
        .filter((account) => !account.isPaid)
        .reduce((sum, account) => sum + getAccountBalanceValue(account, transactionTotals), 0);
      return { day, total, pending };
    }).filter((group) => Math.round(group.pending * 100) !== 0),
  }));
}
