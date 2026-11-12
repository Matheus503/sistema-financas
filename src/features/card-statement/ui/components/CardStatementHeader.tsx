"use client";

import AppHeader from "../../../../components/AppHeader";

type CardStatementHeaderProps = {
  total: number;
  showValues: boolean;
  formatMoney: (value: number) => string;
  onToggleValues: () => void;
  onLaunch: () => void;
  onOpenFullStatement: () => void;
  onBack: () => void;
};

export default function CardStatementHeader({
  total,
  showValues,
  formatMoney,
  onToggleValues,
  onLaunch,
  onOpenFullStatement,
  onBack,
}: CardStatementHeaderProps) {
  return (
    <>
      <AppHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extrato de cartão</h1>
          <p className="text-zinc-400 text-sm">Lançamentos da fatura do mês selecionado</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onLaunch} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl shadow" type="button">
            + Lançar
          </button>
          <button onClick={onOpenFullStatement} className="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-xl" type="button">
            Extrato completo
          </button>
          <button onClick={onBack} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl" type="button">
            Voltar
          </button>
        </div>
      </AppHeader>

      <div className="bg-purple-800 p-6 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <p className="text-sm text-purple-200">Total do extrato</p>
          <h2 className="text-3xl font-bold">{showValues ? formatMoney(total) : "R$ ••••••"}</h2>
        </div>
        <button
          onClick={onToggleValues}
          type="button"
          className="text-3xl leading-none opacity-90 hover:opacity-100 transition"
          aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10.6 10.8a3.2 3.2 0 0 0 4.6 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7.4 7.6C4.9 9.2 3.3 12 3.3 12s3.5 6.5 8.7 6.5c1 0 1.9-.1 2.7-.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.7 5.7A11.4 11.4 0 0 1 12 5.5C17.1 5.5 20.7 12 20.7 12a17.4 17.4 0 0 1-2.2 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
