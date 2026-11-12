"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export type DashboardArea = "finances" | "investor" | "goals";
type Props = {
  realBalance: number;
  projectedBalance: number;
  averageBalance: number | null;
  formatMoney: (value: number) => string;
  valuesVisible: boolean;
  onToggleValues: () => void;
  activeArea: DashboardArea;
  onActiveAreaChange: (area: DashboardArea) => void;
  children: ReactNode;
};

const areas: DashboardArea[] = ["finances", "investor", "goals"];
const areaLabels: Record<DashboardArea, string> = {
  finances: "Finanças",
  investor: "Investidor",
  goals: "Objetivos",
};

function EyeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.6 10.8a3.2 3.2 0 0 0 4.6 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.4 7.6C4.9 9.2 3.3 12 3.3 12s3.5 6.5 8.7 6.5c1 0 1.9-.1 2.7-.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.7 5.7A11.4 11.4 0 0 1 12 5.5C17.1 5.5 20.7 12 20.7 12a17.4 17.4 0 0 1-2.2 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardOverview({
  realBalance,
  projectedBalance,
  averageBalance,
  formatMoney,
  valuesVisible,
  onToggleValues,
  activeArea,
  onActiveAreaChange,
  children,
}: Props) {
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const activeIndex = areas.indexOf(activeArea);
  const previousArea = activeIndex > 0 ? areas[activeIndex - 1] : null;
  const nextArea = activeIndex < areas.length - 1 ? areas[activeIndex + 1] : null;
  const slideTransform = activeArea === "finances"
    ? "translate-x-0"
    : activeArea === "investor"
      ? "-translate-x-1/3"
      : "-translate-x-2/3";

  const goPrevious = () => {
    if (previousArea) onActiveAreaChange(previousArea);
  };
  const goNext = () => {
    if (nextArea) onActiveAreaChange(nextArea);
  };
  const handlePointerStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    setSwipeStartX(event.clientX);
  };
  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStartX === null) return;
    const deltaX = event.clientX - swipeStartX;
    if (deltaX < -70) goNext();
    if (deltaX > 70) goPrevious();
    setSwipeStartX(null);
  };

  return (
    <>
      <div className="bg-purple-800 p-6 rounded-xl mb-6 flex items-center justify-between gap-6">
        <div className="flex flex-wrap items-stretch gap-4 sm:gap-8">
          <div className="min-w-[8rem]">
            <h2 className="text-sm text-purple-100">Saldo real</h2>
            <p className="text-2xl font-bold text-white">{formatMoney(realBalance)}</p>
          </div>
          <div className="hidden w-px bg-purple-300/30 sm:block" />
          <div className="min-w-[8rem]">
            <h2 className="text-sm text-purple-200">Saldo previsto</h2>
            <p className="text-2xl font-bold text-purple-100">{formatMoney(projectedBalance)}</p>
          </div>
          <div className="hidden w-px bg-purple-300/30 sm:block" />
          <div className="min-w-[8rem]">
            <h2 className="text-sm text-purple-200">Saldo médio</h2>
            <p className="text-2xl font-bold text-purple-100">{averageBalance === null ? "—" : formatMoney(averageBalance)}</p>
          </div>
        </div>
        <button onClick={onToggleValues} type="button" className="text-3xl leading-none opacity-90 hover:opacity-100 transition" aria-label={valuesVisible ? "Ocultar valores" : "Mostrar valores"} title={valuesVisible ? "Ocultar valores" : "Mostrar valores"}>
          {valuesVisible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3" aria-label="Navegação das áreas do dashboard">
        <button type="button" onClick={goPrevious} disabled={!previousArea} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-default disabled:text-white" aria-label={`Mostrar área ${areaLabels[previousArea || "finances"]}`}>
          <ArrowLeft size={16} /> {areaLabels[previousArea || "finances"]}
        </button>
        <div className="flex items-center gap-2" aria-hidden="true">
          {areas.map((area) => <span key={area} className={`h-2 w-2 rounded-full ${activeArea === area ? "bg-purple-400" : "bg-zinc-700"}`} />)}
        </div>
        <button type="button" onClick={goNext} disabled={!nextArea} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-default disabled:text-white" aria-label={`Mostrar área ${areaLabels[nextArea || "goals"]}`}>
          {areaLabels[nextArea || "goals"]} <ArrowRight size={16} />
        </button>
      </div>

      <div
        className="overflow-hidden touch-pan-y"
        onPointerDown={handlePointerStart}
        onPointerUp={handlePointerEnd}
        onPointerCancel={() => setSwipeStartX(null)}
        onKeyDown={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, [contenteditable='true']")) return;
          if (event.key === "ArrowRight") goNext();
          if (event.key === "ArrowLeft") goPrevious();
        }}
        tabIndex={0}
        aria-label="Áreas do sistema financeiro. Use as setas esquerda e direita para navegar."
      >
        <div className={`flex w-[300%] transition-transform duration-300 ease-out ${slideTransform}`}>{children}</div>
      </div>
    </>
  );
}
