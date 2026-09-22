"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  years: number[];
  start: number | null;
  end: number | null;
  onChange: (start: number, end: number) => void;
};

export default function YearRangeSelect({ years, start, end, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const apply = (first: number, last: number) => {
    onChange(first, last);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const latest = Math.max(...years);
  const earliest = Math.min(...years);

  return (
    <div ref={rootRef} className="relative min-w-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    }}>
      <span className="mb-2 block text-xs text-zinc-400">Período</span>
      <button ref={triggerRef} type="button" aria-label="Selecionar período de anos" aria-expanded={open} disabled={!years.length}
        onClick={() => { setDraftStart(start); setDraftEnd(end); setChoosingEnd(false); setOpen(current => !current); }}
        className="min-h-11 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-purple-400 disabled:opacity-50">
        {start === null || end === null ? "Selecionar anos" : start === end ? start : `${start} a ${end}`}
      </button>
      {open && <div ref={panelRef} className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl shadow-black/50">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Ano mais recente", first: latest, last: latest },
            { label: "Últimos 3 anos", first: Math.max(earliest, latest - 2), last: latest },
            { label: "Últimos 5 anos", first: Math.max(earliest, latest - 4), last: latest },
            { label: "Todo o histórico", first: earliest, last: latest },
          ].map(preset => <button type="button" key={preset.label} onClick={() => apply(preset.first, preset.last)} className="rounded-xl bg-zinc-800 px-2 py-2 text-xs font-medium text-zinc-200 hover:bg-purple-500/20 focus-visible:outline-2 focus-visible:outline-purple-400">{preset.label}</button>)}
        </div>
        <p className="mt-3 text-xs text-zinc-400">Atalhos contados a partir de {latest}, o ano mais recente cadastrado.</p>
        <div className="my-3 border-t border-zinc-800" />
        <p className="mb-3 text-xs text-zinc-400">Selecione um ano ou clique no primeiro e no último ano do intervalo.</p>
        <div className="category-scroll grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
          {years.map(year => <button key={year} type="button" aria-pressed={draftStart !== null && draftEnd !== null && year >= draftStart && year <= draftEnd}
            onClick={() => {
              if (!choosingEnd || draftStart === null) { setDraftStart(year); setDraftEnd(year); setChoosingEnd(true); }
              else { setDraftStart(Math.min(draftStart, year)); setDraftEnd(Math.max(draftStart, year)); setChoosingEnd(false); }
            }}
            className={`min-h-10 rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-purple-400 ${draftStart !== null && draftEnd !== null && year >= draftStart && year <= draftEnd ? "bg-purple-500/20 font-semibold text-purple-200" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>{year}</button>)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
          <span aria-live="polite" className="text-xs text-zinc-300">{draftStart === draftEnd ? draftStart : `${draftStart} a ${draftEnd}`}</span>
          <button type="button" disabled={draftStart === null || draftEnd === null} onClick={() => { if (draftStart !== null && draftEnd !== null) apply(draftStart, draftEnd); }} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">Aplicar</button>
        </div>
      </div>}
    </div>
  );
}
