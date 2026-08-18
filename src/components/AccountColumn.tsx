"use client";

import { useMemo } from "react";
import {
  formatAccountNameWithDueDay,
  isCalculatedAccount,
  isCreditCardAccount,
  isPixAccount,
} from "../services/accountService";
import type { FinanceAccount } from "../services/accountService";

type Props = {
  title: string;
  type: string;
  accounts: FinanceAccount[];
  totalValue: number;
  getAccountValue: (acc: FinanceAccount) => number;
  formatMoney: (v: number) => string;
  onDelete: (acc: FinanceAccount) => void;
  onToggle: (acc: FinanceAccount) => void;
  onEdit: (acc: FinanceAccount) => void;
  onEditDetails: (acc: FinanceAccount) => void;
  onAdd: (type: string) => void;
  onOpenStatement?: (acc: FinanceAccount) => void;
  onOpenPixHistory?: (acc: FinanceAccount) => void;
  onEditExpectedValue?: (acc: FinanceAccount) => void;
  onReorder?: (type: string, draggedId: string, targetId: string) => void;
};

const paymentDays = [4, 10, 15, 19];

const getPaymentDayForDueDay = (dueDay: number) => {
  const paymentDay = paymentDays
    .filter((day) => day <= dueDay)
    .at(-1);

  return paymentDay ?? dueDay;
};

const getValidDueDay = (account: FinanceAccount) => {
  const dueDay = Number(account.dia_vencimento);

  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
    ? dueDay
    : null;
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
  onEditDetails,
  onAdd,
  onOpenStatement,
  onOpenPixHistory,
  onEditExpectedValue,
}: Props) {
  const columnAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.type === type)
      .map((account, index) => ({ account, index }))
      .sort((a, b) => {
        const aDueDay = getValidDueDay(a.account);
        const bDueDay = getValidDueDay(b.account);
        const aSortDay =
          aDueDay === null ? Number.POSITIVE_INFINITY : aDueDay;
        const bSortDay =
          bDueDay === null ? Number.POSITIVE_INFINITY : bDueDay;
        const aOrder = Number.isFinite(Number(a.account.order))
          ? Number(a.account.order)
          : a.index;
        const bOrder = Number.isFinite(Number(b.account.order))
          ? Number(b.account.order)
          : b.index;

        if (aSortDay !== bSortDay) return aSortDay - bSortDay;
        return aOrder - bOrder;
      })
      .map(({ account }) => account);
  }, [accounts, type]);

  const dueDayTotals = useMemo(() => {
    const totals = new Map<number, number>();

    columnAccounts.forEach((account) => {
      const dueDay = getValidDueDay(account);
      if (dueDay === null) return;

      const paymentDay = getPaymentDayForDueDay(dueDay);

      totals.set(
        paymentDay,
        (totals.get(paymentDay) || 0) + getAccountValue(account)
      );
    });

    return Array.from(totals.entries()).sort(
      ([dayA], [dayB]) => dayA - dayB
    );
  }, [columnAccounts, getAccountValue]);

  return (
    <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <div className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
            <span>Total: {formatMoney(totalValue)}</span>
            {dueDayTotals.map(([day, value]) => (
              <span key={day}>| Dia {day}: {formatMoney(value)}</span>
            ))}
          </div>
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
            const isCreditCard = isCreditCardAccount(acc);
            const isPix = isPixAccount(acc);
            const isProtectedAccount = isCalculatedAccount(acc);
            const canEditDetails = !isProtectedAccount || isCreditCard || isPix;

            return (
              <div
                key={acc.id}
                onClick={() => {
                  onToggle(acc);
                }}
                className={`flex justify-between items-center p-3 rounded-xl cursor-pointer transition border
                  ${
                    acc.isPaid
                      ? "bg-green-500/18 border-l-4 border-l-green-400 border-green-400/25 hover:bg-green-500/24"
                      : "bg-red-500/18 border-l-4 border-l-red-400 border-red-400/25 hover:bg-red-500/24"
                  }
                `}
              >
                <span
                  className={`pr-2 ${
                    !canEditDetails
                      ? "cursor-default"
                      : "cursor-pointer hover:underline"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canEditDetails) return;
                    onEditDetails(acc);
                  }}
                >
                  {formatAccountNameWithDueDay(acc)}
                </span>

                <div
                  className="flex gap-2 items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isCreditCard ? (
                    <div className="flex items-center gap-1 font-semibold">
                      <span
                        onClick={() => onOpenStatement?.(acc)}
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
                      onClick={() => {
                        if (isPix) {
                          onOpenPixHistory?.(acc);
                          return;
                        }
                        onEdit(acc);
                      }}
                      className="cursor-pointer hover:underline"
                    >
                      {formatMoney(getAccountValue(acc))}
                    </span>
                  )}

                  {!isProtectedAccount && (
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
