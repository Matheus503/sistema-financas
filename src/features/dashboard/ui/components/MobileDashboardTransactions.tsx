"use client";

import SearchSelect from "../../../../components/SearchSelect";
import type { FinanceTransaction } from "../../../../domain/finance/transaction";
import type { GroupMemberListItem } from "../../../../domain/finance/groupMember";
import { Trash2 } from "lucide-react";

type MobileDashboardTransactionsProps = {
  transactions: FinanceTransaction[];
  members: GroupMemberListItem[];
  launcherFilter: string;
  onLauncherFilterChange: (value: string) => void;
  getMemberLabel: (member: GroupMemberListItem) => string;
  getLauncherName: (transaction: FinanceTransaction) => string;
  formatDate: (date?: string) => string;
  renderValue: (value: number) => string;
  onEdit: (transaction: FinanceTransaction) => void;
  onDelete: (transaction: FinanceTransaction) => void;
};

const ALL_LAUNCHERS = "all";

export default function MobileDashboardTransactions({
  transactions,
  members,
  launcherFilter,
  onLauncherFilterChange,
  getMemberLabel,
  getLauncherName,
  formatDate,
  renderValue,
  onEdit,
  onDelete,
}: MobileDashboardTransactionsProps) {
  return (
    <section className="bg-zinc-900 p-4 rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-zinc-400">Últimos lançamentos</p>
        <SearchSelect
          aria-label="Quem lançou"
          searchPlaceholder="Buscar quem lançou"
          value={launcherFilter}
          onChange={(event) => onLauncherFilterChange(event.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 outline-none"
        >
          <option value={ALL_LAUNCHERS}>Todos</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {getMemberLabel(member)}
            </option>
          ))}
        </SearchSelect>
      </div>

      {transactions.length === 0 && (
        <p className="text-zinc-500 text-sm">Nenhum lançamento ainda</p>
      )}

      <div className="max-h-[52vh] overflow-y-auto pr-1 flex flex-col gap-2">
        {transactions.map((transaction) => {
          const launcherName = getLauncherName(transaction);
          return (
            <div key={transaction.id} className="border-b border-zinc-800 pb-2">
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {transaction.category || "Sem categoria"} - {formatDate(transaction.date)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-1">
                <span className="text-zinc-500">
                  {launcherName
                    ? `${launcherName}${transaction.note ? ` - ${transaction.note}` : ""}`
                    : transaction.note || ""}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    className="text-red-400 font-semibold text-sm"
                    onClick={() => onEdit(transaction)}
                    type="button"
                  >
                    {renderValue(Number(transaction.value))}
                  </button>
                  <button onClick={() => onDelete(transaction)} type="button" aria-label="Excluir lançamento">
                    <Trash2 size={16} className="text-zinc-500" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
