"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import PaymentSchedule from "./PaymentSchedule";
import type { FinanceAccount } from "../services/accountService";

type Props = {
  accounts: FinanceAccount[];
  getAccountValue: (account: FinanceAccount) => number;
  formatMoney: (value: number) => string;
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  hasPreviousMonth: boolean;
  hasNextMonth: boolean;
  showValues: boolean;
  onToggleValues: () => void;
  onClose: () => void;
};

export default function MobilePaymentSchedule({ monthLabel, onPreviousMonth, onNextMonth, hasPreviousMonth, hasNextMonth, showValues, onToggleValues, ...props }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Agenda financeira — ${monthLabel}`}
      onCancel={event => { event.preventDefault(); props.onClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-zinc-950 p-0 text-white backdrop:bg-black/70"
    >
      <div className="sticky top-0 z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 border-b border-zinc-700/70 bg-black/75 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-lg shadow-black/30 backdrop-blur-md min-[400px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <h2 className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800" title="Agenda financeira">
          <CalendarDays size={24} aria-hidden="true" />
          <span className="sr-only">Agenda financeira</span>
        </h2>
        <div className="flex items-center justify-self-center rounded-full border border-zinc-800 bg-zinc-900">
          <button type="button" onClick={onPreviousMonth} disabled={!hasPreviousMonth} aria-label="Mês anterior" className="flex h-9 w-8 items-center justify-center rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-purple-400">
            <ChevronLeft size={16} />
          </button>
          <p aria-live="polite" className="whitespace-nowrap text-xs font-medium text-purple-300">{monthLabel}</p>
          <button type="button" onClick={onNextMonth} disabled={!hasNextMonth} aria-label="Mês seguinte" className="flex h-9 w-8 items-center justify-center rounded-full hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-purple-400">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center justify-self-end gap-1">
        <button
          type="button"
          onClick={onToggleValues}
          aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-purple-400"
        >
          {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        <button
          type="button"
          onClick={props.onClose}
          className="min-h-11 rounded-xl bg-zinc-800 px-2 text-xs font-medium transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-purple-400"
        >
          Voltar
        </button>
        </div>
      </div>
      <div className="p-4">
        <PaymentSchedule {...props} showTitle={false} showBackButton={false} />
      </div>
    </dialog>
  );
}
