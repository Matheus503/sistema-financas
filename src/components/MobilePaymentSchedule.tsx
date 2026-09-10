"use client";

import { useEffect, useRef } from "react";
import PaymentSchedule from "./PaymentSchedule";
import type { FinanceAccount } from "../services/accountService";

type Props = {
  accounts: FinanceAccount[];
  getAccountValue: (account: FinanceAccount) => number;
  formatMoney: (value: number) => string;
  monthLabel: string;
  onClose: () => void;
};

export default function MobilePaymentSchedule({ monthLabel, ...props }: Props) {
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
      aria-label={`Agenda de pagamentos — ${monthLabel}`}
      onCancel={event => { event.preventDefault(); props.onClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-zinc-950 p-4 text-white backdrop:bg-black/70"
    >
      <p className="mb-3 text-sm font-medium text-purple-300">{monthLabel}</p>
      <PaymentSchedule {...props} />
    </dialog>
  );
}
