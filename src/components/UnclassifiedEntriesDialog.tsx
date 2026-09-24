"use client";

import { useEffect, useState } from "react";
import ReportDetailDialog from "./ReportDetailDialog";
import { getAccountsByMonth, type FinanceAccount } from "../services/accountService";
import { linkUnclassifiedTransaction } from "../services/transactionService";
import type { StatementTransaction } from "../lib/expenseStatement";
import { monthNames } from "../lib/monthlyReport";

type Props = {
  entries: StatementTransaction[];
  money: (value: number) => string;
  onClose: () => void;
  onLinked: (entry: StatementTransaction, account: FinanceAccount) => void;
};

export default function UnclassifiedEntriesDialog({ entries, money, onClose, onLinked }: Props) {
  const [accounts, setAccounts] = useState<Record<string, FinanceAccount[]>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const monthIds = JSON.stringify([...new Set(entries.map(e => e.monthId).filter((id): id is string => !!id))].sort());
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const results = await Promise.all((JSON.parse(monthIds) as string[]).map(async id => [id, await getAccountsByMonth(id)] as const));
        if (active) setAccounts(Object.fromEntries(results) as Record<string, FinanceAccount[]>);
      } catch { if (active) setError("Não foi possível carregar as contas."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [monthIds, retry]);

  async function save(entry: StatementTransaction) {
    const key = `${entry.monthId}/${entry.id}`;
    if (!entry.monthId || !choices[key] || saving) return;
    setSaving(key); setError("");
    try {
      const account = await linkUnclassifiedTransaction(entry.monthId, entry.id, choices[key]);
      onLinked(entry, account);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível vincular a conta."); }
    finally { setSaving(""); }
  }

  return <ReportDetailDialog id="unclassified-entries" title="Identificar contas" busy={!!saving} onClose={onClose}>
    {error && <div className="mb-3"><p role="alert" className="text-sm text-red-300">{error}</p><button type="button" disabled={!!saving} onClick={() => setRetry(v => v + 1)} className="mt-2 text-sm text-purple-300 underline">Recarregar contas</button></div>}
    {loading ? <p role="status" className="text-sm text-zinc-400">Carregando contas...</p> : !entries.length ? <p role="status" className="text-sm text-green-300">Todos os lançamentos foram identificados.</p> : <ul className="divide-y divide-zinc-800">{entries.map(entry => {
      const key = `${entry.monthId}/${entry.id}`;
      const options = (accounts[entry.monthId || ""] || []).filter(a => ["CREDIT", "FIXED", "VARIABLE"].includes(a.type));
      return <li key={key} className="space-y-3 py-4">
        <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{entry.note || entry.category || "Sem descrição"}</p><span className="tabular-nums text-amber-200">{money(entry.value)}</span></div>
        <p className="text-xs text-zinc-400">{monthNames[entry.month - 1]} / {entry.year} · {entry.category || "Sem categoria"}{entry.date ? ` · Data: ${entry.date.split("-").reverse().join("/")}` : ""}</p>
        <form onSubmit={event => { event.preventDefault(); void save(entry); }} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-400">Conta do lançamento<select required value={choices[key] || ""} disabled={!!saving || !options.length} onChange={e => setChoices(current => ({ ...current, [key]: e.target.value }))} className="min-h-10 w-full rounded bg-zinc-800 p-2 text-sm text-white"><option value="">Selecione a conta</option>{options.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type === "CREDIT" ? "Crédito" : a.type === "FIXED" ? "Fixa" : "Variável"}</option>)}</select></label>
          <button type="submit" disabled={!!saving || !choices[key]} className="rounded bg-purple-600 px-4 py-2 text-sm font-semibold transition hover:bg-purple-700 disabled:opacity-50">{saving === key ? "Salvando..." : "Vincular conta"}</button>
        </form>
        {!options.length && <p className="text-xs text-zinc-400">Cadastre uma conta neste mês para vincular o lançamento.</p>}
      </li>;
    })}</ul>}
  </ReportDetailDialog>;
}
