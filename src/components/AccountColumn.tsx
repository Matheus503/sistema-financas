"use client";

import { useMemo, useState } from "react";

type Props = {
  title: string;
  type: string;
  accounts: any[];
  totalValue: number;
  getAccountValue: (acc: any) => number;
  formatMoney: (v: number) => string;
  onDelete: (acc: any) => void;
  onToggle: (acc: any) => void;
  onEdit: (acc: any) => void;
  onAdd: (type: string) => void;
  onOpenStatement?: () => void;
  onEditExpectedValue?: (acc: any) => void;
  onReorder?: (type: string, draggedId: string, targetId: string) => void;
};

export default function AccountColumn({
  title,
  type,
  accounts,
  totalValue,
  getAccountValue,
  formatMoney,
  onDelete,
  onToggle,
  onEdit,
  onAdd,
  onOpenStatement,
  onEditExpectedValue,
  onReorder,
}: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [suppressClick, setSuppressClick] = useState(false);

  const columnAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.type === type)
      .map((account, index) => ({ account, index }))
      .sort((a, b) => {
        const aOrder = Number.isFinite(Number(a.account.order))
          ? Number(a.account.order)
          : a.index;
        const bOrder = Number.isFinite(Number(b.account.order))
          ? Number(b.account.order)
          : b.index;

        return aOrder - bOrder;
      })
      .map(({ account }) => account);
  }, [accounts, type]);

  return (
    <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-zinc-400">
            Total: {formatMoney(totalValue)}
          </p>
        </div>

        <button
          onClick={() => onAdd(type)}
          className="bg-purple-600 hover:bg-purple-700 w-7 h-7 rounded-full transition"
          type="button"
        >
          +
        </button>
      </div>

      <div className="space-y-2">
        {columnAccounts
          .map((acc) => {
            const isNubank = acc.name?.includes("Nubank");
            const isDragging = draggedId === acc.id;

            return (
              <div
                key={acc.id}
                draggable
                onDragStart={() => {
                  setDraggedId(acc.id);
                  setSuppressClick(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();

                  if (draggedId && draggedId !== acc.id) {
                    onReorder?.(type, draggedId, acc.id);
                  }

                  setDraggedId(null);
                  window.setTimeout(() => setSuppressClick(false), 0);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  window.setTimeout(() => setSuppressClick(false), 0);
                }}
                onClick={() => {
                  if (suppressClick) return;
                  onToggle(acc);
                }}
                className={`flex justify-between items-center p-3 rounded-xl cursor-grab active:cursor-grabbing transition border
                  ${
                    acc.isPaid
                      ? "bg-green-500/18 border-l-4 border-l-green-400 border-green-400/25 hover:bg-green-500/24"
                      : "bg-red-500/18 border-l-4 border-l-red-400 border-red-400/25 hover:bg-red-500/24"
                  }
                  ${isDragging ? "opacity-50 ring-2 ring-purple-400" : ""}
                `}
              >
                <span className="pr-2">{acc.name}</span>

                <div
                  className="flex gap-2 items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isNubank ? (
                    <div className="flex items-center gap-1 font-semibold">
                      <span
                        onClick={() => onOpenStatement?.()}
                        className="cursor-pointer hover:underline"
                      >
                        {formatMoney(getAccountValue(acc))}
                      </span>

                      <span className="text-zinc-400">/</span>

                      <span
                        onClick={() => onEditExpectedValue?.(acc)}
                        className="cursor-pointer text-purple-200 hover:underline"
                        title="Editar valor previsto"
                      >
                        {formatMoney(Number(acc.expectedValue || 0))}
                      </span>
                    </div>
                  ) : (
                    <span
                      onClick={() => onEdit(acc)}
                      className="cursor-pointer hover:underline"
                    >
                      {formatMoney(getAccountValue(acc))}
                    </span>
                  )}

                  {!isNubank && (
                    <button onClick={() => onDelete(acc)} type="button">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
