"use client";

import { FileCheck2, List, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import InvoiceReconciliationModal from "./InvoiceReconciliationModal";

type TransactionItem = {
  id: string;
  transactionId: string;
  monthId: string;
  date: string;
  value: number;
  monthLabel: string;
  monthOrder: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  accountName?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  transactionType?: string;
};

type TransactionGroup = {
  monthLabel: string;
  items: TransactionItem[];
};

type Props = {
  groups: TransactionGroup[];
  showValues: boolean;
  formatMoney: (value: number) => string;
  onEdit: (item: TransactionItem) => void;
  onDelete: (item: TransactionItem) => void;
};

export default function TransactionList({
  groups,
  showValues,
  formatMoney,
  onEdit,
  onDelete,
}: Props) {
  const [listViewGroups, setListViewGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [reconciliationGroup, setReconciliationGroup] =
    useState<TransactionGroup | null>(null);

  const formatDate = (dateString: string) => {
    const dateKey = String(dateString || "").slice(0, 10);
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      return `${match[3]}/${match[2]}`;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "--/--";

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getDisplayCategory = (item: TransactionItem) => {
    if (item.transactionType === "installment_anticipation_discount") {
      return "Desconto antecipação";
    }

    return item.category?.trim() || "Lançamento";
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const isListView = listViewGroups[group.monthLabel] === true;
        const categoryTotals = Object.entries(
          group.items.reduce<Record<string, number>>((totals, item) => {
            const category = getDisplayCategory(item);
            totals[category] = (totals[category] || 0) + Number(item.value || 0);

            return totals;
          }, {})
        ).sort(([categoryA], [categoryB]) =>
          categoryA.localeCompare(categoryB, "pt-BR")
        );
        const groupTotal = categoryTotals.reduce(
          (sum, [, value]) => sum + value,
          0
        );

        return (
          <div
            key={group.monthLabel}
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
              <div className="flex min-w-0 items-center gap-3">
                <h2 className="font-semibold text-zinc-100">
                  {group.monthLabel}
                </h2>

                <button
                  onClick={() =>
                    setListViewGroups((current) => ({
                      ...current,
                      [group.monthLabel]: !current[group.monthLabel],
                    }))
                  }
                  type="button"
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
                    isListView
                      ? "border-purple-400/40 bg-purple-500/20 text-purple-100"
                      : "border-zinc-700 bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
                  }`}
                  aria-label={
                    isListView
                      ? "Voltar para lancamentos"
                      : "Ver resumo por categoria"
                  }
                  title={
                    isListView
                      ? "Voltar para lancamentos"
                      : "Ver resumo por categoria"
                  }
                >
                  {isListView ? <Rows3 size={16} /> : <List size={16} />}
                </button>
              </div>

              <button
                onClick={() => setReconciliationGroup(group)}
                type="button"
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-800/70 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
                aria-label="Conciliar fatura"
                title="Conciliar fatura"
              >
                <FileCheck2 size={17} />
              </button>
            </div>

            {isListView ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead className="bg-zinc-800/80 text-xs text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Valor
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-800">
                    {categoryTotals.map(([category, value]) => (
                      <tr
                        key={category}
                        className="hover:bg-zinc-800/40 transition"
                      >
                        <td className="px-4 py-3 font-semibold text-zinc-100">
                          {category}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-400">
                          {showValues ? formatMoney(value) : "R$ ••••••"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-700 bg-zinc-800/90">
                      <td className="px-4 py-3 font-bold text-zinc-100">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">
                        {showValues ? formatMoney(groupTotal) : "R$ ••••••"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {group.items.map((item) => {
                  const hasNote = item.note?.trim();
                  const displayCategory = getDisplayCategory(item);

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[90px_1fr_140px_30px] gap-3 px-4 py-3 items-center hover:bg-zinc-800/40 transition"
                    >
                      <span className="text-sm text-zinc-300">
                        {formatDate(item.date)}
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {displayCategory}
                        </p>

                        {hasNote && (
                          <p className="text-xs text-zinc-400 truncate">
                            {item.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          onClick={() => onEdit(item)}
                          className="text-red-400 font-semibold cursor-pointer hover:underline"
                        >
                          {showValues ? formatMoney(item.value) : "R$ ••••••"}
                        </span>
                      </div>

                      <button
                        onClick={() => onDelete(item)}
                        className="text-zinc-400 hover:text-red-400"
                        title="Excluir"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {reconciliationGroup && (
        <InvoiceReconciliationModal
          open={Boolean(reconciliationGroup)}
          monthLabel={reconciliationGroup.monthLabel}
          systemItems={reconciliationGroup.items.map((item) => ({
            id: item.id,
            transactionId: item.transactionId,
            date: item.date,
            value: item.value,
            category: item.category,
            note: item.note,
            accountName: item.accountName,
            installmentCurrent: item.installmentCurrent,
            installmentTotal: item.installmentTotal,
            transactionType: item.transactionType,
          }))}
          onClose={() => setReconciliationGroup(null)}
        />
      )}
    </div>
  );
}
