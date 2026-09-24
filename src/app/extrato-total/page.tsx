"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronDown, ChevronUp, Eye, EyeOff, Filter, List, Tags, Wallet } from "lucide-react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import AppHeader from "../../components/AppHeader";
import UnclassifiedEntriesDialog from "../../components/UnclassifiedEntriesDialog";
import YearRangeSelect from "../../components/YearRangeSelect";
import SearchSelect from "../../components/SearchSelect";
import { useValueVisibility } from "../../hooks/useValueVisibility";
import { auth } from "../../lib/auth";
import { monthNames } from "../../lib/monthlyReport";
import { summarizeExpenses, type StatementTransaction } from "../../lib/expenseStatement";
import { getTransactions } from "../../services/transactionService";
import { getAccountsByMonth, type FinanceAccount } from "../../services/accountService";
import { getAllMonths } from "../../services/monthService";
import { ensureUserProfile, getGroupMembers, type GroupMemberListItem } from "../../services/userService";

export const dynamic = "force-dynamic";
type MonthDoc = { id: string; year: number; month: number };
type RawTransaction = Omit<StatementTransaction, "year" | "month"> & { accountId?: string };
const panel = "rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-lg shadow-black/10";
const button = "rounded-xl bg-zinc-800 px-4 py-2 text-sm transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-purple-400";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function matchesMember(transaction: StatementTransaction, member: GroupMemberListItem) {
  const id = transaction.launcherId || transaction.userId;
  if (member.status === "active" && id) return id === member.id;
  const names = [transaction.launcherName, transaction.userName, transaction.userEmail].filter(Boolean).map(value => normalize(value!));
  return [member.name, member.email, member.email.split("@")[0]].filter(Boolean).some(value => names.includes(normalize(value)));
}

export default function ExtratoTotalPage() {
  const router = useRouter();
  const [months, setMonths] = useState<MonthDoc[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [endYear, setEndYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [launcherFilter, setLauncherFilter] = useState("all");
  const [members, setMembers] = useState<GroupMemberListItem[]>([]);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showUnclassified, setShowUnclassified] = useState(false);
  const [chartsExpanded, setChartsExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showValues, setShowValues] = useValueVisibility();
  const money = (value: number) => showValues ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "••••";

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = auth.onAuthStateChanged(async user => {
      const request = ++generation;
      setTransactions([]); setMonths([]); setMembers([]); setLoading(true); setError("");
      if (!user) { router.replace("/"); return; }
      try {
        const profile = await ensureUserProfile(user);
        const [documents, groupMembers] = await Promise.all([getAllMonths(profile.groupId), getGroupMembers(profile.groupId)]);
        const history = documents.map(m => ({ id: m.id, year: Number(m.year), month: Number(m.month) }));
        const all: StatementTransaction[] = [];
        for (let offset = 0; offset < history.length; offset += 6) {
          if (!active || request !== generation) return;
          const batches = await Promise.all(history.slice(offset, offset + 6).map(async month => {
            const [entries, accounts] = await Promise.all([getTransactions(month.id), getAccountsByMonth(month.id)]);
            const types = new Map((accounts as FinanceAccount[]).map(a => [a.id, a.type]));
            return (entries as RawTransaction[]).map(t => ({ ...t, value: Number(t.value), monthId: month.id, year: month.year, month: month.month, accountType: types.get(t.accountId || "") }));
          }));
          all.push(...batches.flat());
        }
        if (!active || request !== generation) return;
        if (all.some(t => !Number.isFinite(t.value))) throw new Error("Há lançamentos com valores inválidos. Corrija-os no extrato antes de consultar os totais.");
        setMonths(history); setMembers(groupMembers); setTransactions(all);
        const requestedId = new URLSearchParams(window.location.search).get("monthId");
        const initial = history.find(m => m.id === requestedId)?.year || history.find(m => m.year === new Date().getFullYear())?.year || history.at(-1)?.year || null;
        setSelectedYear(current => current ?? initial); setEndYear(current => current ?? initial);
      } catch (err) {
        if (active && request === generation) setError(err instanceof Error ? err.message : "Não foi possível carregar o extrato.");
      } finally { if (active && request === generation) setLoading(false); }
    });
    return () => { active = false; unsubscribe(); };
  }, [router, retry]);

  const years = [...new Set(months.map(m => m.year))].sort((a, b) => a - b);
  const availableMonths = [...new Set(months.filter(m => selectedYear !== null && endYear !== null && m.year >= selectedYear && m.year <= endYear).map(m => m.month))].sort((a, b) => a - b);
  const summary = useMemo(() => {
    const inPeriod = (m: { year: number; month: number }) => selectedYear !== null && endYear !== null && m.year >= selectedYear && m.year <= endYear && (!selectedMonth || m.month === selectedMonth);
    const member = members.find(m => m.id === launcherFilter);
    const filtered = transactions.filter(t => inPeriod(t) && (launcherFilter === "all" || (member && matchesMember(t, member))));
    return summarizeExpenses(filtered, months.filter(inPeriod));
  }, [transactions, months, members, launcherFilter, selectedYear, endYear, selectedMonth]);
  const barData = summary.rows.map(row => ({ ...row, name: `${monthNames[row.month - 1].slice(0, 3)}/${String(row.year).slice(-2)}` }));
  const leadingCategory = summary.categories.find(category => category.value > 0);
  const tooltipStyle = { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, color: "#fff" };
  const hiddenChart = <p className="py-6 text-center text-sm text-zinc-400">Mostre os valores para visualizar o gráfico.</p>;

  return <main className="min-h-screen bg-gradient-to-b from-black to-zinc-900 px-4 pb-24 text-white sm:px-6 sm:pb-6">
    <AppHeader className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Extrato Total</h1>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setShowValues(v => !v)} className={`${button} hidden sm:block`} aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}>{showValues ? <Eye size={20} /> : <EyeOff size={20} />}</button>
        <Link href="/dashboard" className={`${button} hidden sm:block`}>Voltar</Link><Link href="/mobile" className={`${button} sm:hidden`}>Voltar</Link>
      </div>
    </AppHeader>
    <div className="mx-auto max-w-7xl space-y-3">
      <section className={panel} aria-label="Filtros do extrato">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-purple-200"><Filter size={16} aria-hidden="true" />Filtros</div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <YearRangeSelect years={years} start={selectedYear} end={endYear} onChange={(first, last) => { setSelectedYear(first); setEndYear(last); setSelectedMonth(null); }} />
          <label className="flex min-w-0 flex-col gap-2"><span className="text-xs text-zinc-400">Mês</span><SearchSelect aria-label="Mês" searchPlaceholder="Buscar mês" value={selectedMonth ?? ""} onChange={e => setSelectedMonth(e.target.value ? Number(e.target.value) : null)} className="min-h-11 w-full bg-zinc-800 px-3 py-2 text-sm"><option value="">Todos os meses</option>{availableMonths.map(m => <option key={m} value={m}>{monthNames[m - 1]}</option>)}</SearchSelect></label>
          <label className="flex min-w-0 flex-col gap-2"><span className="text-xs text-zinc-400">Quem lançou</span><SearchSelect aria-label="Quem lançou" searchPlaceholder="Buscar pessoa" value={launcherFilter} onChange={e => setLauncherFilter(e.target.value)} className="min-h-11 w-full bg-zinc-800 px-3 py-2 text-sm"><option value="all">Todas as pessoas</option>{members.map(member => <option key={member.id} value={member.id}>{member.name || member.email.split("@")[0] || "Sem nome"}</option>)}</SearchSelect></label>
          <button type="button" className="min-h-11 rounded-xl bg-purple-500/15 px-4 py-2 text-sm text-purple-200 transition hover:bg-purple-500/25" onClick={() => { const y = years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years.at(-1) ?? null; setSelectedYear(y); setEndYear(y); setSelectedMonth(null); setLauncherFilter("all"); }}>Limpar filtros</button>
        </div>
      </section>

      {loading ? <div className={panel} role="status">Carregando extrato...</div> : error ? <div className={panel}><p role="alert" className="mb-3 text-red-300">{error}</p><button type="button" className={button} onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div> : !months.length ? <div className={panel}>Nenhum mês cadastrado.</div> : <>
        {summary.unclassified > 0 && <button type="button" aria-haspopup="dialog" onClick={() => setShowUnclassified(true)} className="text-left text-sm text-amber-200 underline underline-offset-4 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-purple-400">{summary.unclassified} {summary.unclassified === 1 ? "lançamento sem conta identificada ficou fora dos totais" : "lançamentos sem conta identificada ficaram fora dos totais"} · Identificar conta</button>}
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do período">
          <div className="rounded-xl border border-purple-500/40 bg-purple-800 px-4 py-3"><div className="flex items-center justify-between text-sm text-purple-100">Total lançado<Wallet size={18} aria-hidden="true" /></div><p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.total)}</p></div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3"><div className="flex items-center justify-between text-sm text-amber-200">Maior categoria<Tags size={18} aria-hidden="true" /></div><p className="mt-1 truncate font-semibold text-amber-100">{showValues ? leadingCategory?.name || "—" : "••••"}</p><p className="mt-1 text-sm tabular-nums text-amber-200">{leadingCategory ? money(leadingCategory.value) : "—"}</p></div>
          <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-4 py-3"><div className="flex items-center justify-between text-sm text-purple-200">Lançamentos<List size={18} aria-hidden="true" /></div><p className="mt-1 text-2xl font-semibold tabular-nums text-purple-100">{showValues ? summary.count : "••••"}</p></div>
        </section>
        {!summary.count ? <div className={panel}><h2 className="font-semibold">Nenhuma despesa lançada nos filtros selecionados</h2><p className="mt-2 text-sm text-zinc-400">Escolha outro período ou outra pessoa.</p></div> : <>
          <section className={`${panel} relative`} aria-label="Gráficos do extrato">
            <button type="button" onClick={() => setChartsExpanded(value => !value)} aria-expanded={chartsExpanded} aria-controls="expense-category-chart expense-month-chart" aria-label={chartsExpanded ? "Minimizar gráficos" : "Expandir gráficos"} className="absolute right-3 top-3 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400">
              {chartsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <div className="grid divide-y divide-zinc-700/70 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <section className="min-w-0 pb-3 pr-10 lg:pb-0 lg:pr-4"><h2 className="flex min-h-9 items-center gap-2 font-semibold"><span className="rounded-lg bg-amber-500/15 p-2 text-amber-300"><Tags size={18} aria-hidden="true" /></span>Por categoria</h2>
              <div id="expense-category-chart" hidden={!chartsExpanded} className="mt-2">{chartsExpanded && (showValues ? <div className="category-scroll h-[clamp(11rem,28dvh,14rem)] overflow-y-auto pr-2"><ResponsiveContainer width="100%" height={Math.max(200, summary.categories.length * 38)}><BarChart data={summary.categories} layout="vertical" margin={{ left: 0, right: 18, top: 5, bottom: 5 }} accessibilityLayer><CartesianGrid horizontal={false} stroke="#3f3f46" /><XAxis type="number" stroke="#a1a1aa" tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString("pt-BR", { notation: "compact" })} /><YAxis dataKey="name" type="category" width={100} stroke="#a1a1aa" tick={{ fontSize: 11 }} tickFormatter={v => String(v).length > 15 ? `${String(v).slice(0, 14)}…` : v} /><ReferenceLine x={0} stroke="#71717a" /><Tooltip formatter={v => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} /><Bar dataKey="value" name="Total lançado" fill="#fbbf24" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : hiddenChart)} </div>
            </section>
            <section className="min-w-0 pt-3 lg:pl-4 lg:pt-0"><h2 className="flex min-h-9 items-center gap-2 pr-10 font-semibold"><span className="rounded-lg bg-purple-500/15 p-2 text-purple-300"><BarChart3 size={18} aria-hidden="true" /></span>Mês a mês</h2>
              <div id="expense-month-chart" hidden={!chartsExpanded} className="mt-2">{chartsExpanded && (showValues ? <div className="h-[clamp(11rem,28dvh,14rem)]"><ResponsiveContainer width="100%" height="100%"><BarChart data={barData} accessibilityLayer margin={{ left: 0, right: 8, top: 5, bottom: 5 }}><CartesianGrid vertical={false} stroke="#3f3f46" /><XAxis dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 11 }} minTickGap={20} /><YAxis width={55} stroke="#a1a1aa" tick={{ fontSize: 11 }} tickFormatter={v => Number(v).toLocaleString("pt-BR", { notation: "compact" })} /><ReferenceLine y={0} stroke="#71717a" /><Tooltip formatter={v => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "#27272a" }} /><Bar dataKey="total" name="Total lançado" fill="#a78bfa" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : hiddenChart)} </div>
            </section>
          </div>
          </section>
          <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><span className="rounded-lg bg-purple-500/15 p-2 text-purple-300"><List size={18} aria-hidden="true" /></span>Detalhamento por mês e categoria</h2><button type="button" onClick={() => setDetailsExpanded(value => !value)} aria-expanded={detailsExpanded} aria-controls="expense-detail-table" aria-label={detailsExpanded ? "Minimizar detalhamento" : "Expandir detalhamento"} className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400">{detailsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button></div><div id="expense-detail-table" hidden={!detailsExpanded} className="mt-3"><div className="category-scroll overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-sm tabular-nums"><caption className="sr-only">Despesas por categoria de {selectedYear} a {endYear}, em reais</caption><thead className="bg-purple-500/10 text-xs text-purple-100"><tr><th scope="col" className="p-3 text-left">Mês / ano</th>{summary.categories.map(c => <th scope="col" key={c.name} className="p-3">{c.name}</th>)}<th scope="col" className="p-3 text-amber-200">Total</th></tr></thead><tbody>{summary.rows.map(row => <tr key={row.key} className="border-t border-zinc-800 transition hover:bg-purple-500/5"><th scope="row" className="p-3 text-left font-medium text-purple-200">{monthNames[row.month - 1]} / {row.year}</th>{summary.categories.map(c => <td className="p-3 text-zinc-300" key={c.name}>{money(row.values[c.name] || 0)}</td>)}<td className="p-3 font-semibold text-amber-200">{money(row.total)}</td></tr>)}</tbody><tfoot className="border-t border-purple-500/30 bg-purple-500/10 font-semibold text-purple-100"><tr><th scope="row" className="p-3 text-left">Total do período</th>{summary.categories.map(c => <td className="p-3" key={c.name}>{money(c.value)}</td>)}<td className="p-3 text-amber-200">{money(summary.total)}</td></tr></tfoot></table></div></div></section>
        </>}
      </>}
    </div>
    {showUnclassified && <UnclassifiedEntriesDialog entries={summary.unclassifiedEntries} money={money} onClose={() => setShowUnclassified(false)} onLinked={(entry, account) => setTransactions(current => current.map(t => t.id === entry.id && t.monthId === entry.monthId ? { ...t, accountId: account.id, accountType: account.type } : t))} />}
    <button type="button" onClick={() => setShowValues(v => !v)} aria-label={showValues ? "Ocultar valores" : "Mostrar valores"} className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-white shadow-lg backdrop-blur-md transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-purple-400 sm:hidden">{showValues ? <EyeOff size={22} /> : <Eye size={22} />}</button>
  </main>;
}
