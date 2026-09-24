"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

let openDialogs = 0;
let originalBodyOverflow = "";

type Props = {
  id?: string;
  compact?: boolean;
  title: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
};

export default function ReportDetailDialog({ id = "month-detail", compact = false, title, onClose, busy, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    if (openDialogs === 0) originalBodyOverflow = document.body.style.overflow;
    openDialogs += 1;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = originalBodyOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={`${id}-title`}
      aria-modal="true"
      aria-busy={busy}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget && !busy) onClose(); }}
      className={`m-auto w-[calc(100%-2rem)] ${compact ? "max-w-80" : "max-w-3xl"} max-h-[90dvh] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-white backdrop:bg-black/70`}
    >
      <div className="flex max-h-[calc(90dvh-3rem)] flex-col">
        <header className="mb-3 flex shrink-0 items-start justify-between gap-4">
          <h2 id={`${id}-title`} className="text-lg font-bold">{title}</h2>
          {!compact && <button type="button" aria-label={`Fechar ${title}`} disabled={busy} onClick={onClose} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400 disabled:opacity-50"><X size={20} /></button>}
        </header>
        <div className="category-scroll min-h-0 overflow-y-auto overscroll-contain pr-2">{children}</div>
      </div>
    </dialog>
  );
}
