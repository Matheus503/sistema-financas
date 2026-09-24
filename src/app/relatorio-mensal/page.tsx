"use client";

import AppHeader from "../../components/AppHeader";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, BarChart3, ChevronDown, ChevronUp, Eye, EyeOff, Table2, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { auth } from "../../lib/auth";
import { ensureUserProfile } from "../../services/userService";
import { getMonthlyReportData } from "../../services/monthlyReportService";
import { updateAccountPaidOn } from "../../services/accountService";
import { buildMonthlyReport, localDate, monthNames, settlementMonth, type SettledAccount } from "../../lib/monthlyReport";
import { useValueVisibility } from "../../hooks/useValueVisibility";
import SearchSelect from "../../components/SearchSelect";
import ReportDetailDialog from "../../components/ReportDetailDialog";

export const dynamic = "force-dynamic";
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fields = ["received", "fixed", "variable", "paid", "balance"] as const;
const labels = { CREDIT: "Recebimento", FIXED: "Conta fixa", VARIABLE: "Conta variável" };
const panel = "rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-lg shadow-black/10 sm:p-4";
const button = "rounded-xl bg-zinc-800 px-4 py-2 text-sm transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-purple-400";

export default function MonthlyReportPage() {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonthlyReportData>> | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<SettledAccount | null>(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showValues, setShowValues] = useValueVisibility();
  const [chartExpanded, setChartExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const summaryCarousel = useRef<HTMLElement>(null);
  const [summaryIndex, setSummaryIndex] = useState(0);
  const money = (value: number | null) => value === null ? "—" : showValues ? currency(value) : "••••";

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = auth.onAuthStateChanged(async user => {
      const request = ++generation;
      setData(null);
      setLoading(true);
      setError("");
      if (!user) { router.replace("/"); return; }
      try {
        const profile = await ensureUserProfile(user);
        const result = await getMonthlyReportData(profile.groupId);
        if (!active || request !== generation) return;
        setData(result);
      } catch (err) {
        if (active && request === generation) setError(err instanceof Error ? err.message : "Não foi possível carregar o relatório.");
      } finally {
        if (active && request === generation) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [router, retry]);

  const report = useMemo(() => buildMonthlyReport(data?.accounts || [], data?.months || [], year), [data, year]);
  const years = useMemo(() => [...new Set([new Date().getFullYear(), ...(data?.months.map(m => m.year) || []), ...(data?.accounts.map(a => settlementMonth(a).year) || [])])].sort((a, b) => b - a), [data]);
  const detail = report.rows.find(row => row.month === selectedMonth);

  async function saveDate(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateAccountPaidOn(editing.monthId, editing.accountId, date);
      setData(current => current && ({ ...current, accounts: current.accounts.map(a => a.monthId === editing.monthId && a.accountId === editing.accountId ? { ...a, paidOn: date } : a) }));
      setYear(Number(date.slice(0, 4)));
      setSelectedMonth(Number(date.slice(5, 7)));
      setEditing(null);
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Não foi possível salvar a data."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-gradient-to-b from-black to-zinc-900 px-4 pb-24 text-white sm:px-6 sm:pb-4">
    <div className="mx-auto max-w-7xl space-y-3">
      <AppHeader className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="hidden text-2xl font-bold sm:block">Recebimentos e gastos mensais</h1>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <label className="flex items-center gap-2 text-sm text-zinc-300">Ano<SearchSelect aria-label="Ano do relatório" searchPlaceholder="Buscar ano" value={year} onChange={e => { setYear(Number(e.target.value)); setSelectedMonth(null); setEditing(null); }} className="min-h-10 min-w-24 bg-zinc-800 px-3 py-2">{years.map(y => <option key={y} value={y}>{y}</option>)}</SearchSelect></label>
          <button className={`${button} hidden sm:block`} type="button" onClick={() => setShowValues(v => !v)} aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}>{showValues ? <Eye size={20} /> : <EyeOff size={20} />}</button><Link className={`${button} hidden sm:block`} href="/dashboard">Voltar</Link><Link className={`${button} sm:hidden`} href="/mobile">Voltar</Link>
        </div>
      </AppHeader>
      {loading ? <div className={panel} role="status">Carregando recebimentos e pagamentos...</div> : error ? <div className={panel}><p role="alert" className="mb-4 text-red-300">{error}</p><button type="button" className={button} onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div> : !data?.months.length ? <div className={panel}><h2 className="font-semibold">Seu histórico começa aqui</h2><p className="mt-2 text-sm text-zinc-400">Crie um mês e registre suas contas para acompanhar os recebimentos, pagamentos e médias.</p></div> : <>
        <section ref={summaryCarousel} aria-label="Médias mensais" onScroll={event => { const element = event.currentTarget; if (element.clientWidth) setSummaryIndex(Math.max(0, Math.min(2, Math.round(element.scrollLeft / element.clientWidth)))); }} className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible">
          {[
            { title: "Recebimento médio", value: report.averages.received, icon: ArrowDownLeft, surface: "border-green-500/25 bg-green-500/10", iconStyle: "bg-green-500/15 text-green-300", text: "text-green-200" },
            { title: "Gasto médio", value: report.averages.paid, icon: ArrowUpRight, surface: "border-amber-500/25 bg-amber-500/10", iconStyle: "bg-amber-500/15 text-amber-300", text: "text-amber-200" },
            { title: "Saldo médio", value: report.averages.balance, icon: Wallet, surface: "border-purple-500/40 bg-purple-800", iconStyle: "bg-purple-400/20 text-purple-100", text: showValues && (report.averages.balance ?? 0) < 0 ? "text-red-200" : "text-white" },
          ].map(item => <div className={`min-w-full shrink-0 snap-center rounded-xl border px-4 py-3 shadow-lg shadow-black/10 sm:min-w-0 ${item.surface}`} key={item.title}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-zinc-200">{item.title}</h2><span className={`rounded-lg p-1.5 ${item.iconStyle}`}><item.icon size={18} aria-hidden="true" /></span></div><p className={`mt-1 text-2xl font-semibold tabular-nums ${item.text}`}>{money(item.value)}</p>{item.title === "Gasto médio" && <p className="mt-2 text-xs text-amber-200/80 tabular-nums">Contas fixas {money(report.averages.fixed)} | Variáveis {money(report.averages.variable)}</p>}</div>)}
        </section>
        <div className="flex justify-center gap-1 sm:hidden" aria-label="Selecionar card de resumo">
          {["Recebimento médio", "Gasto médio", "Saldo médio"].map((label, index) => <button key={label} type="button" aria-label={`Mostrar ${label.toLowerCase()}`} aria-pressed={summaryIndex === index} onClick={() => { const element = summaryCarousel.current; if (element) element.scrollTo({ left: element.clientWidth * index, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }} className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-purple-400"><span className={`h-1.5 rounded-full transition-all ${summaryIndex === index ? "w-5 bg-purple-400" : "w-1.5 bg-zinc-600"}`} /></button>)}
        </div>
        <section className={panel} aria-label="Gráfico mensal">
          <div className="flex items-center gap-2">
            <span className="mr-1 rounded-lg bg-purple-500/15 p-2 text-purple-300"><BarChart3 size={20} aria-hidden="true" /></span>
            <h2 className="font-semibold">Comparação mês a mês</h2>
            <button type="button" onClick={() => setChartExpanded(value => !value)} aria-expanded={chartExpanded} aria-controls="monthly-comparison-chart" aria-label={chartExpanded ? "Minimizar comparação mês a mês" : "Expandir comparação mês a mês"} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400">
              {chartExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          <div id="monthly-comparison-chart" hidden={!chartExpanded}>
          {chartExpanded && <>
          <p className="mb-2 mt-1 text-xs text-zinc-400">Recebimentos ao lado dos gastos fixos e variáveis · valores em reais.</p>
          {showValues ? <div className="h-[clamp(11rem,30dvh,15rem)] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.rows.filter(r => r.status === "complete" || r.status === "current")} accessibilityLayer margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid vertical={false} stroke="#3f3f46" /><XAxis dataKey="shortName" stroke="#a1a1aa" tick={{ fontSize: 12 }} /><YAxis width={65} stroke="#a1a1aa" tick={{ fontSize: 12 }} tickFormatter={v => Number(v).toLocaleString("pt-BR", { notation: "compact" })} />
            <Tooltip formatter={value => currency(Number(value))} labelFormatter={label => `${label} / ${year}`} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} cursor={{ fill: "#27272a" }} /><Legend />
            <Bar dataKey="received" name="Recebido" fill="#34d399" stackId="income" radius={[4, 4, 0, 0]} /><Bar dataKey="fixed" name="Fixas pagas" fill="#a78bfa" stackId="expenses" /><Bar dataKey="variable" name="Variáveis pagas" fill="#fbbf24" stackId="expenses" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div> : <p className="py-6 text-center text-sm text-zinc-400">Mostre os valores para visualizar o gráfico.</p>}
          </>}
          </div>
        </section>
        <section className={`${panel} hidden sm:block`}><div className="flex items-center gap-3"><span className="rounded-lg bg-purple-500/15 p-2 text-purple-300"><Table2 size={20} aria-hidden="true" /></span><h2 className="font-semibold">Detalhamento mensal</h2><button type="button" onClick={() => setDetailsExpanded(value => !value)} aria-expanded={detailsExpanded} aria-controls="monthly-detail-table" aria-label={detailsExpanded ? "Minimizar detalhamento mensal" : "Expandir detalhamento mensal"} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400">{detailsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button></div><div id="monthly-detail-table" hidden={!detailsExpanded}><p className="mb-4 mt-1 text-xs text-zinc-400">Selecione um mês para consultar as contas. Saldo do mês = recebido − pago.</p><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-sm tabular-nums"><caption className="sr-only">Recebimentos e pagamentos de {year}</caption><thead className="bg-purple-500/10 text-xs text-purple-100"><tr>{["Mês", "Recebido", "Fixas pagas", "Variáveis pagas", "Total pago", "Saldo do mês"].map((h, i) => <th key={h} scope="col" className={`px-3 py-3 ${i === 0 ? "text-left" : ""}`}>{h}</th>)}</tr></thead><tbody>
          {report.rows.map(row => <tr key={row.month} className={`border-t border-zinc-800 transition-colors hover:bg-purple-500/5 ${selectedMonth === row.month ? "bg-purple-500/10" : ""}`}><th scope="row" className="px-3 py-3 text-left font-normal"><button type="button" disabled={row.status === "before" || row.status === "future"} aria-haspopup="dialog" aria-controls={selectedMonth === row.month ? "month-detail" : undefined} className="rounded py-1 text-purple-200 underline-offset-4 hover:underline disabled:text-zinc-500 disabled:no-underline" onClick={() => { setSelectedMonth(row.month); setEditing(null); setSaveError(""); }}>{row.name}</button>{row.status !== "complete" && <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${row.status === "current" ? "bg-purple-500/15 text-purple-200" : "text-zinc-500"}`}>{row.status === "current" ? "Em andamento" : row.status === "future" ? "Futuro" : "Sem histórico"}</span>}</th>{fields.map(key => <td className={`px-3 py-3 ${key === "received" ? "text-green-300" : key === "fixed" ? "text-purple-200" : key === "variable" || key === "paid" ? "text-amber-200" : showValues && row.balance < 0 ? "text-red-300" : "text-zinc-100"}`} key={key}>{row.status === "before" || row.status === "future" ? "—" : money(row[key])}</td>)}</tr>)}
        </tbody><tfoot className="border-t border-purple-500/30 font-semibold"><tr className="bg-purple-500/10 text-purple-100"><th scope="row" className="px-3 py-4 text-left">Média · {report.count} meses <span className="whitespace-normal text-xs font-normal text-zinc-400">(A média considera somente meses completos)</span></th>{fields.map(key => <td key={key} className="px-3 py-4">{money(report.averages[key])}</td>)}</tr><tr className="border-t border-purple-500/15 bg-purple-500/5 text-zinc-100"><th scope="row" className="px-3 py-3 text-left">Total realizado <span className="whitespace-normal text-xs font-normal text-zinc-400">(O total inclui o mês em andamento)</span></th>{fields.map(key => <td key={key} className="px-3 py-3">{money(report.totals[key])}</td>)}</tr></tfoot></table></div></div></section>
        {detail && <ReportDetailDialog title={`${detail.name} de ${year} · contas confirmadas`} busy={saving} onClose={() => { setSelectedMonth(null); setEditing(null); setSaveError(""); }}>{!detail.entries.length ? <p className="text-sm text-zinc-400">Nenhum recebimento ou pagamento confirmado neste mês.</p> : <ul className="divide-y divide-zinc-800">{detail.entries.map(account => <li key={`${account.monthId}/${account.accountId}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p>{account.name}</p><p className="mt-1 text-xs text-zinc-400">{labels[account.type]} · Origem: {monthNames[account.sourceMonth - 1]}/{account.sourceYear} · {account.paidOn ? `Confirmado em ${account.paidOn.split("-").reverse().join("/")}` : "Data não registrada"}</p></div><div className="flex items-center gap-3"><span className="tabular-nums">{money(account.value)}</span><button type="button" className="rounded bg-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-600 disabled:opacity-50" disabled={saving} aria-haspopup="dialog" onClick={() => { setEditing(account); setDate(account.paidOn || localDate(new Date(year, detail.month - 1, 1))); setSaveError(""); }}>{account.paidOn ? "Corrigir data" : "Informar data"}</button></div></li>)}</ul>}
          {editing && <ReportDetailDialog id="settlement-date" compact title={editing.type === "CREDIT" ? "Data do Recebimento" : "Data do Pagamento"} busy={saving} onClose={() => { setEditing(null); setSaveError(""); }}><form onSubmit={saveDate}><div><label className="mb-3 block"><input aria-labelledby="settlement-date-title" type="date" required max={localDate()} min="1900-01-01" value={date} disabled={saving} onChange={e => setDate(e.target.value)} className="w-full rounded bg-zinc-800 p-2 text-white [color-scheme:dark]" /></label><div className="flex justify-between gap-2"><button type="submit" disabled={saving} className="rounded bg-purple-600 px-4 py-2 font-semibold transition hover:bg-purple-700 disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button><button type="button" disabled={saving} className="rounded bg-zinc-700 px-4 py-2 font-semibold transition hover:bg-zinc-600 disabled:opacity-50" onClick={() => setEditing(null)}>Cancelar</button></div></div>{saveError && <p role="alert" className="mt-3 text-sm text-red-300">{saveError}</p>}</form></ReportDetailDialog>}
        </ReportDetailDialog>}
      </>}
    </div>
    <button type="button" onClick={() => setShowValues(value => !value)} aria-label={showValues ? "Ocultar valores" : "Mostrar valores"} className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-white shadow-lg backdrop-blur-md transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 sm:hidden">
      {showValues ? <EyeOff size={22} /> : <Eye size={22} />}
    </button>
  </main>;
}
