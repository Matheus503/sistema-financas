"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Plus, Target } from "lucide-react";
import ReportDetailDialog from "./ReportDetailDialog";
import {
  getFinancialGoalsData,
  saveFinancialGoal,
  confirmFinancialGoalContribution,
  type FinancialGoal,
} from "../services/financialGoalsService";

type Props = {
  groupId: string;
  userId: string;
  monthId: string;
  year: number;
  month: number;
  formatMoney: (amount: number) => string;
  onMonthlyPlanChange?: (amountCents: number) => void;
};

const parseCurrency = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return normalized.trim() ? Number(normalized) : Number.NaN;
};
const formatCurrencyField = (cents: number) => (cents / 100).toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatCurrencyTyping = (value: string) => {
  const cents = Number(value.replace(/\D/g, ""));
  return formatCurrencyField(cents);
};

export default function FinancialGoalsPanel({
  groupId,
  userId,
  monthId,
  year,
  month,
  formatMoney,
  onMonthlyPlanChange,
}: Props) {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const selectedKey = `${groupId}:${monthId}:${monthKey}`;
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("0,00");
  const [durationMonths, setDurationMonths] = useState("12");

  const refreshData = useCallback(async () => {
    const data = await getFinancialGoalsData(groupId, year, month, monthId);
    setGoals(data.goals);
    onMonthlyPlanChange?.(data.monthlyPlanCents);
    setLoadedKey(selectedKey);
    setLoadError("");
  }, [groupId, year, month, monthId, selectedKey, onMonthlyPlanChange]);

  useEffect(() => {
    let active = true;
    void getFinancialGoalsData(groupId, year, month, monthId).then((data) => {
      if (!active) return;
      setGoals(data.goals);
      onMonthlyPlanChange?.(data.monthlyPlanCents);
      setLoadedKey(selectedKey);
      setLoadError("");
    }).catch((error: unknown) => {
      console.error("Erro ao carregar os objetivos financeiros:", error);
      if (!active) return;
      setLoadError("Não foi possível carregar os objetivos deste mês. Tente novamente.");
    });
    return () => { active = false; };
  }, [groupId, year, month, monthId, selectedKey, onMonthlyPlanChange]);

  const isReady = loadedKey === selectedKey && !loadError;
  const openNewGoal = () => {
    setEditingGoal(null);
    setName("");
    setTargetAmount("0,00");
    setDurationMonths("12");
    setMessage("");
    setIsFormOpen(true);
  };

  const openEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(formatCurrencyField(goal.targetAmountCents));
    setDurationMonths(String(goal.durationMonths || 12));
    setMessage("");
    setIsFormOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const parsedTarget = parseCurrency(targetAmount);
    const parsedDuration = Number(durationMonths);
    if (!name.trim() || !Number.isFinite(parsedTarget) || parsedTarget <= 0 || !Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 600) {
      setMessage("Informe um nome, uma meta maior que zero e um prazo entre 1 e 600 meses.");
      return;
    }
    setIsSaving(true);
    try {
      await saveFinancialGoal(groupId, userId, year, month, monthId, {
        name,
        targetAmountCents: Math.round(parsedTarget * 100),
        durationMonths: parsedDuration,
      }, editingGoal?.id);
      await refreshData();
      setIsFormOpen(false);
      setMessage(editingGoal ? "Objetivo atualizado a partir deste mês." : "Objetivo criado.");
    } catch (error) {
      console.error("Erro ao salvar objetivo financeiro:", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o objetivo.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmContribution = async (goal: FinancialGoal) => {
    setIsSaving(true);
    setMessage("");
    try {
      await confirmFinancialGoalContribution(groupId, userId, year, month, monthId, goal.id);
      await refreshData();
      setMessage(`Reserva de ${goal.name} efetivada neste mês.`);
    } catch (error) {
      console.error("Erro ao atualizar objetivo financeiro:", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o objetivo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="category-scroll max-h-[calc(100dvh-12rem)] min-h-[420px] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 pr-3 sm:p-8 sm:pr-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Objetivos financeiros</h2>
        </div>
        <button type="button" onClick={openNewGoal} disabled={!isReady || isSaving} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50">
          <Plus size={16} /> Novo objetivo
        </button>
      </div>

      {loadError && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{loadError}</div>}
      {!isReady && !loadError && <p className="mb-4 text-sm text-zinc-400">Carregando objetivos…</p>}

      {isReady && goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-black/10 p-8 text-center">
          <Target className="mx-auto mb-3 text-purple-300" size={28} />
          <h3 className="font-semibold">Nenhum objetivo cadastrado</h3>
          <p className="mt-1 text-sm text-zinc-400">Crie uma meta e defina quanto ficará reservado por mês.</p>
          <button type="button" onClick={openNewGoal} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold hover:bg-purple-500"><Plus size={16} /> Criar primeiro objetivo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {goals.map((goal) => {
            const progress = goal.targetAmountCents > 0 ? Math.min(100, goal.reservedAmountCents / goal.targetAmountCents * 100) : 0;
            const remaining = Math.max(0, goal.targetAmountCents - goal.reservedAmountCents);
            return (
              <article key={goal.id} className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{goal.name}</h3>
                    <p className="mt-1 text-xs text-zinc-400">Meta: {formatMoney(goal.targetAmountCents / 100)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-400">Reservado</span>
                    <strong className="mt-1 block text-xl tabular-nums">{formatMoney(goal.reservedAmountCents / 100)}</strong>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-purple-200">{progress.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label={`Progresso de ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>Faltam {formatMoney(remaining)}</span>
                  <span>{`${formatMoney(goal.plannedMonthlyCents / 100)}/mês · ${goal.durationMonths} ${goal.durationMonths === 1 ? "mês" : "meses"}`}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                  <button type="button" disabled={!isReady || isSaving} onClick={() => openEditGoal(goal)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">Editar</button>
                  <button type="button" disabled={!isReady || isSaving || goal.isConfirmedThisMonth || goal.plannedMonthlyCents <= 0} onClick={() => void confirmContribution(goal)} className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${goal.isConfirmedThisMonth ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "bg-purple-600 text-white hover:bg-purple-500"}`}>
                    {goal.isConfirmedThisMonth ? <><Check size={14} /> Efetivado neste mês</> : <>Efetivar reserva · {formatMoney(goal.plannedMonthlyCents / 100)}</>}
                  </button>
                  {goal.reservedAmountCents >= goal.targetAmountCents && <span className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-emerald-300"><Check size={14} /> Meta alcançada</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {message && <p role="status" className="mt-4 text-sm text-zinc-300">{message}</p>}

      {isFormOpen && (
        <ReportDetailDialog title={editingGoal ? "Editar objetivo" : "Novo objetivo"} onClose={() => !isSaving && setIsFormOpen(false)} busy={isSaving}>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block text-sm text-zinc-300">
              Nome do objetivo
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Ex.: Comprar um carro" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-purple-400" disabled={isSaving} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Valor da meta
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 focus-within:border-purple-400">
                  <span className="text-sm text-zinc-500">R$</span>
                  <input type="text" inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(formatCurrencyTyping(event.target.value))} className="w-full bg-transparent py-2.5 text-right tabular-nums text-white outline-none" disabled={isSaving} />
                </div>
              </label>
              <label className="block text-sm text-zinc-300">
                Em quanto tempo?
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 focus-within:border-purple-400">
                  <input type="number" min={1} max={600} step={1} value={durationMonths} onChange={(event) => setDurationMonths(event.target.value)} className="w-full bg-transparent py-2.5 text-right tabular-nums text-white outline-none" disabled={isSaving} />
                  <span className="text-sm text-zinc-500">meses</span>
                </div>
              </label>
            </div>
            <div className="rounded-lg border border-purple-400/20 bg-purple-400/5 px-3 py-2.5 text-sm text-zinc-300">
              Reserva estimada: <strong className="text-purple-200">{formatMoney(Math.ceil(Math.max(0, (Math.round((parseCurrency(targetAmount) || 0) * 100) - (editingGoal?.reservedBeforeMonthCents || 0)) / Math.max(1, Number(durationMonths) || 1)) / 100))}/mês</strong>
            </div>
            <p className="text-xs text-zinc-500">A reserva estimada só será descontada dos saldos real e previsto quando você efetivá-la no mês. Alterações não modificam os meses anteriores.</p>
            {message && <p role="alert" className="text-sm text-red-300">{message}</p>}
            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
              <button type="button" onClick={() => setIsFormOpen(false)} disabled={isSaving} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSaving || !isReady} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">{isSaving ? "Salvando…" : "Salvar objetivo"}</button>
            </div>
          </form>
        </ReportDetailDialog>
      )}
    </div>
  );
}
