"use client";

import { Trash2 } from "lucide-react";
import SearchSelect from "../../../../components/SearchSelect";
import type { FinanceAccount } from "../../../../domain/finance/account";
import type { GroupMemberListItem } from "../../../../domain/finance/groupMember";
import type { FinanceTransaction } from "../../../../domain/finance/transaction";

type Props = {
  account: FinanceAccount | null;
  transactions: FinanceTransaction[];
  editingTransaction: FinanceTransaction | undefined;
  deletingTransaction: FinanceTransaction | null;
  members: GroupMemberListItem[];
  launcherFilter: string;
  editValue: string;
  formatMoney: (value: number) => string;
  onFilterChange: (value: string) => void;
  onCloseHistory: () => void;
  onStartEdit: (transaction: FinanceTransaction) => void;
  onAskDelete: (transaction: FinanceTransaction) => void;
  onEditValueChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesMember(transaction: FinanceTransaction, member: GroupMemberListItem) {
  const launcherId = transaction.launcherId || transaction.userId || "";
  if (member.status === "active" && launcherId && launcherId === member.id) return true;

  const rawLauncher = normalizeText(
    `${transaction.launcherName || ""} ${transaction.userName || ""} ${transaction.userEmail || ""}`,
  );
  const memberName = normalizeText(member.name);
  const memberEmail = normalizeText(member.email);
  const memberEmailPrefix = normalizeText(member.email.split("@")[0] || "");

  return Boolean(rawLauncher && (
    (memberName && rawLauncher.includes(memberName))
    || (memberEmail && rawLauncher.includes(memberEmail))
    || (memberEmailPrefix && rawLauncher.includes(memberEmailPrefix))
  ));
}

function getMemberLabel(member: GroupMemberListItem) {
  return member.name || member.email.split("@")[0] || "Sem nome";
}

function formatTransactionDate(value?: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getTransactionLauncher(transaction: FinanceTransaction) {
  return transaction.launcherName || transaction.userName || transaction.userEmail || "Sem informacao";
}

export default function DashboardPixDialogs({
  account,
  transactions,
  editingTransaction,
  deletingTransaction,
  members,
  launcherFilter,
  editValue,
  formatMoney,
  onFilterChange,
  onCloseHistory,
  onStartEdit,
  onAskDelete,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const accountTransactions = transactions.filter((item) => item.accountId === account?.id);
  const filteredTransactions = accountTransactions.filter((transaction) => {
    if (launcherFilter === "all") return true;
    const selectedMember = members.find((member) => member.id === launcherFilter);
    if (selectedMember) return matchesMember(transaction, selectedMember);
    const rawLauncher = normalizeText(
      `${transaction.launcherName || ""} ${transaction.userName || ""} ${transaction.userEmail || ""}`,
    );
    return rawLauncher.includes(normalizeText(launcherFilter));
  });

  return (
    <>
      {account && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-2xl border border-zinc-800">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold">Historico PIX</h2>
                <p className="text-sm text-zinc-400">Total: {formatMoney(Number(account.value || 0))}</p>
              </div>
              <div className="flex items-center gap-2">
                <SearchSelect
                  aria-label="Quem lançou"
                  searchPlaceholder="Buscar quem lançou"
                  value={launcherFilter}
                  onChange={(event) => onFilterChange(event.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 outline-none"
                >
                  <option value="all">Todos</option>
                  {members.map((member) => <option key={member.id} value={member.id}>{getMemberLabel(member)}</option>)}
                </SearchSelect>
                <button onClick={onCloseHistory} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">
                  Fechar
                </button>
              </div>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="bg-zinc-800/70 rounded-lg p-4 text-zinc-400">Nenhum lancamento PIX encontrado neste mes.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_auto_auto] gap-3 items-center">
                      <div className="font-semibold">{formatTransactionDate(transaction.date)}</div>
                      <div className="text-zinc-300 break-words">
                        <span className="font-semibold text-zinc-200">{getTransactionLauncher(transaction)}</span>
                        {` - ${transaction.note || "-"}`}
                      </div>
                      <button onClick={() => onStartEdit(transaction)} className="font-bold hover:underline md:text-right" type="button">
                        {formatMoney(Number(transaction.value || 0))}
                      </button>
                      <button onClick={() => onAskDelete(transaction)} className="p-1 text-zinc-500 hover:text-red-300 transition justify-self-start md:justify-self-end" type="button" title="Excluir PIX" aria-label="Excluir PIX">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <form className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800" onSubmit={(event) => { event.preventDefault(); onSaveEdit(); }}>
            <h2 className="mb-3 text-lg font-bold">Editar PIX</h2>
            <p className="text-sm text-zinc-400 mb-3">{formatTransactionDate(editingTransaction.date)} - {getTransactionLauncher(editingTransaction)}</p>
            <label className="block mb-3">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">Novo valor</span>
              <input type="tel" inputMode="decimal" value={editValue} onChange={(event) => onEditValueChange(event.target.value)} className="w-full p-2 bg-zinc-800 rounded" placeholder="Novo valor" autoFocus />
            </label>
            <div className="flex justify-between gap-2">
              <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition" type="submit">Salvar</button>
              <button onClick={onCancelEdit} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {deletingTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">Excluir PIX?</h2>
            <p className="text-sm text-zinc-400 mb-5">Deseja realmente excluir este PIX?</p>
            <div className="flex justify-between gap-2">
              <button onClick={onConfirmDelete} className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded font-semibold transition" type="button" autoFocus>Sim</button>
              <button onClick={onCancelDelete} className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition" type="button">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
