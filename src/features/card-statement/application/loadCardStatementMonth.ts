import type { FinanceAccount } from "../../../domain/finance/account";
import type { FinanceMonth } from "../../../domain/finance/month";
import type { GroupMemberListItem } from "../../../domain/finance/groupMember";
import {
  loadCardStatementAccounts,
  loadCardStatementMembers,
  loadCardStatementMonths,
  loadCardStatementTransactions,
} from "./cardStatementCommands";
import {
  buildCardStatementItems,
  type CardStatementItem,
  type CardStatementTransaction,
} from "./cardStatementViewModel";

type LoadedCardStatementMonth = {
  members: GroupMemberListItem[];
  month: FinanceMonth | null;
  monthLabel: string;
  accounts: FinanceAccount[];
  transactions: CardStatementTransaction[];
  items: CardStatementItem[];
};

const emptyResult = (members: GroupMemberListItem[] = []): LoadedCardStatementMonth => ({
  members,
  month: null,
  monthLabel: "Extrato de cartão",
  accounts: [],
  transactions: [],
  items: [],
});

export async function loadCardStatementMonth(
  groupId: string,
  requestedMonthId?: string | null,
): Promise<LoadedCardStatementMonth> {
  const [months, members] = await Promise.all([
    loadCardStatementMonths(groupId) as Promise<FinanceMonth[]>,
    loadCardStatementMembers(groupId),
  ]);
  const month =
    months.find((candidate) => candidate.id === requestedMonthId) ||
    months[months.length - 1] ||
    null;

  if (!month) return emptyResult(members);

  const monthLabel = `Fatura ${String(month.month).padStart(2, "0")}/${month.year}`;

  const [accounts, transactions] = await Promise.all([
    loadCardStatementAccounts(month.id) as Promise<FinanceAccount[]>,
    loadCardStatementTransactions(month.id) as Promise<CardStatementTransaction[]>,
  ]);

  return {
    members,
    month,
    monthLabel,
    accounts,
    transactions,
    items: buildCardStatementItems(month, accounts, transactions),
  };
}
