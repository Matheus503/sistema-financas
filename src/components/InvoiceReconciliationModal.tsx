"use client";

import { AlertTriangle, CheckCircle2, FileUp, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { parseNubankCsv } from "../lib/nubankCsvParser";
import {
  reconcileInvoice,
  type MatchCandidate,
  type ReconciliationReport,
  type ScoreReason,
  type SystemInvoiceEntry,
} from "../lib/invoiceReconciliation";
import type { NubankEntry } from "../lib/nubankCsvParser";

type Props = {
  open: boolean;
  monthLabel: string;
  systemItems: SystemInvoiceEntry[];
  onClose: () => void;
};

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDate = (value: string) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "-";

  return `${match[3]}/${match[2]}/${match[1]}`;
};

const kindLabel: Record<NubankEntry["kind"], string> = {
  expense: "Despesa",
  credit_refund: "Credito/estorno",
  invoice_payment: "Pagamento da fatura",
  discount: "Desconto",
  other: "Outros",
};

const statusConfig = {
  conciliated: {
    label: "Conciliado",
    className: "border-green-500/30 bg-green-500/15 text-green-100",
    Icon: CheckCircle2,
  },
  partially_conciliated: {
    label: "Parcialmente conciliado",
    className: "border-yellow-500/30 bg-yellow-500/15 text-yellow-100",
    Icon: AlertTriangle,
  },
  not_conciliated: {
    label: "Nao conciliado",
    className: "border-red-500/30 bg-red-500/15 text-red-100",
    Icon: XCircle,
  },
};

const reasonClassName = (reason: ScoreReason) => {
  if (reason.tone === "positive") return "text-green-300";
  if (reason.tone === "negative") return "text-red-300";
  if (reason.tone === "warning") return "text-yellow-300";

  return "text-zinc-400";
};

const EntryLine = ({
  label,
  date,
  description,
  value,
}: {
  label: string;
  date: string;
  description: string;
  value: number;
}) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-zinc-500">
      <span>{label}</span>
      <span>{formatDate(date)}</span>
    </div>
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-zinc-100">{description || "-"}</span>
      <span className="shrink-0 font-semibold text-red-400">
        {formatMoney(value)}
      </span>
    </div>
  </div>
);

const MatchCard = ({ match }: { match: MatchCandidate }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-zinc-100">
        Score {match.score}%
      </div>
      <div className="text-xs text-zinc-400">
        {match.confidence === "high"
          ? "Alta confianca"
          : match.confidence === "review"
          ? "Revisar"
          : "Baixa confianca"}
      </div>
    </div>

    <div className="grid gap-2 md:grid-cols-2">
      <EntryLine
        label="Nubank"
        date={match.nubank.date}
        description={match.nubank.title}
        value={match.nubank.amount}
      />
      <EntryLine
        label="Sistema"
        date={match.system.date}
        description={`${match.system.category || "Lancamento"}${
          match.system.note ? ` - ${match.system.note}` : ""
        }`}
        value={match.system.value}
      />
    </div>

    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {match.reasons.map((reason, index) => (
        <span
          key={`${reason.text}-${index}`}
          className={`rounded-full bg-zinc-800 px-2 py-1 ${reasonClassName(
            reason
          )}`}
        >
          {reason.text}
        </span>
      ))}
    </div>
  </div>
);

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
        {count}
      </span>
    </div>
    {count === 0 ? (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-500">
        Nada encontrado nesta secao.
      </div>
    ) : (
      children
    )}
  </section>
);

export default function InvoiceReconciliationModal({
  open,
  monthLabel,
  systemItems,
  onClose,
}: Props) {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [onlyDivergences, setOnlyDivergences] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const hasDivergences = useMemo(() => {
    if (!report) return false;

    return (
      report.audit.missingInSystem +
        report.audit.missingInNubank +
        report.audit.duplicates +
        report.audit.valueDifferences +
        report.audit.reviewMatches >
      0
    );
  }, [report]);

  if (!open) return null;

  const processFile = async (file?: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Selecione um arquivo CSV do Nubank.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseNubankCsv(text);
      setReport(reconcileInvoice(parsed.entries, systemItems));
      setFileName(file.name);
      toast.success("CSV processado com sucesso.");
    } catch (error) {
      console.error("Erro ao conciliar fatura:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel processar o CSV."
      );
    }
  };

  const status = report ? statusConfig[report.status] : null;
  const StatusIcon = status?.Icon;
  const showCleanMatches = Boolean(report && !onlyDivergences);

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 px-4 py-6">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold">Conciliação de Fatura</h2>
            <p className="text-sm text-zinc-400">{monthLabel}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-700"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              processFile(event.dataTransfer.files[0]);
            }}
            className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${
              isDragging
                ? "border-purple-400 bg-purple-500/10"
                : "border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900"
            }`}
          >
            <FileUp className="mb-3 text-purple-300" size={28} />
            <span className="font-semibold">Arraste o CSV do Nubank aqui</span>
            <span className="mt-1 text-sm text-zinc-400">
              ou selecione um arquivo para gerar o relatório
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => processFile(event.target.files?.[0])}
            />
          </label>

          {fileName && (
            <div className="mb-5 text-sm text-zinc-400">
              Arquivo analisado:{" "}
              <span className="font-semibold text-zinc-200">{fileName}</span>
            </div>
          )}

          {!report ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
              O CSV será usado apenas nesta análise local da tela. Nenhum dado
              do arquivo será salvo automaticamente.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ["Total bruto CSV", report.totals.nubankGross],
                  ["Conciliavel Nubank", report.totals.nubankConciliable],
                  ["Excluido da conciliacao", report.totals.nubankExcluded],
                  ["Total sistema", report.totals.system],
                  ["Diferenca", report.totals.difference],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
                  >
                    <div className="text-xs text-zinc-500">{label}</div>
                    <div className="mt-1 text-lg font-bold">
                      {formatMoney(Number(value))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="text-xs text-zinc-500">
                    Diferenca explicada
                  </div>
                  <div className="mt-1 text-lg font-bold text-green-300">
                    {formatMoney(report.totals.explained)}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="text-xs text-zinc-500">
                    Diferenca residual
                  </div>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      Math.abs(report.totals.residual) > 0.01
                        ? "text-yellow-300"
                        : "text-green-300"
                    }`}
                  >
                    {formatMoney(report.totals.residual)}
                  </div>
                </div>
                {status && StatusIcon && (
                  <div
                    className={`flex items-center gap-2 rounded-xl border p-4 font-semibold ${status.className}`}
                  >
                    <StatusIcon size={20} />
                    {status.label}
                  </div>
                )}
              </div>

              <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-8">
                {[
                  ["Nubank", report.audit.nubankTotal],
                  ["Conciliaveis", report.audit.nubankConciliable],
                  ["Encontrados", report.audit.matched],
                  ["Nao encontrados", report.audit.missingInSystem],
                  ["So no sistema", report.audit.missingInNubank],
                  ["Duplicidades", report.audit.duplicates],
                  ["Valor", report.audit.valueDifferences],
                  ["Data", report.audit.dateDifferences],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                  >
                    <div className="text-[11px] text-zinc-500">{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={onlyDivergences}
                  onChange={(event) => setOnlyDivergences(event.target.checked)}
                  className="h-4 w-4 accent-purple-600"
                />
                Somente divergências
              </label>

              {!hasDivergences && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
                  Nenhuma divergencia relevante encontrada na conciliacao.
                </div>
              )}

              <Section
                title="Possíveis duplicidades"
                count={report.duplicates.length}
              >
                <div className="space-y-3">
                  {report.duplicates.map((duplicate) => (
                    <div
                      key={`${duplicate.value}-${duplicate.nubankCount}-${duplicate.systemCount}`}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-zinc-100">
                          Valor {formatMoney(duplicate.value)}
                        </div>
                        <div className="text-sm text-zinc-400">
                          Nubank: {duplicate.nubankCount} | Sistema:{" "}
                          {duplicate.systemCount} | Potencial:{" "}
                          {formatMoney(duplicate.potentialDuplicateValue)}
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="text-xs text-zinc-400">
                          Nubank:{" "}
                          {duplicate.nubankEntries
                            .map((entry) => entry.title)
                            .join(", ") || "-"}
                        </div>
                        <div className="text-xs text-zinc-400">
                          Sistema:{" "}
                          {duplicate.systemEntries
                            .map(
                              (entry) =>
                                `${entry.category || "Lancamento"}${
                                  entry.note ? ` - ${entry.note}` : ""
                                }`
                            )
                            .join(", ") || "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Lançamentos não encontrados no sistema"
                count={report.missingInSystem.length}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {report.missingInSystem.map((entry) => (
                    <EntryLine
                      key={entry.id}
                      label={kindLabel[entry.kind]}
                      date={entry.date}
                      description={entry.title}
                      value={entry.amount}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Lançamentos existentes somente no sistema"
                count={report.missingInNubank.length}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {report.missingInNubank.map((entry) => (
                    <EntryLine
                      key={entry.id}
                      label="Sistema"
                      date={entry.date}
                      description={`${entry.category || "Lancamento"}${
                        entry.note ? ` - ${entry.note}` : ""
                      }`}
                      value={entry.value}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Diferenças de valor"
                count={report.valueDifferences.length}
              >
                <div className="space-y-3">
                  {report.valueDifferences.map((match) => (
                    <MatchCard key={`${match.nubank.id}-${match.system.id}`} match={match} />
                  ))}
                </div>
              </Section>

              <Section
                title="Correspondências para revisão"
                count={report.reviewMatches.length}
              >
                <div className="space-y-3">
                  {report.reviewMatches.map((match) => (
                    <MatchCard key={`${match.nubank.id}-${match.system.id}`} match={match} />
                  ))}
                </div>
              </Section>

              <Section
                title="Diferenças de data"
                count={report.dateDifferences.length}
              >
                <div className="space-y-3">
                  {report.dateDifferences.map((match) => (
                    <MatchCard key={`${match.nubank.id}-${match.system.id}`} match={match} />
                  ))}
                </div>
              </Section>

              {showCleanMatches && (
                <Section title="Correspondências" count={report.matches.length}>
                  <div className="space-y-3">
                    {report.matches.map((match) => (
                      <MatchCard
                        key={`${match.nubank.id}-${match.system.id}`}
                        match={match}
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section
                title="Movimentações excluídas da conciliação"
                count={report.excludedNubankEntries.length}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {report.excludedNubankEntries.map((entry) => (
                    <EntryLine
                      key={entry.id}
                      label={kindLabel[entry.kind]}
                      date={entry.date}
                      description={entry.title}
                      value={entry.amount}
                    />
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
