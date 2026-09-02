"use client";

import { FilePlus2, FileUp, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { parseNubankCsv, type NubankEntry } from "../lib/nubankCsvParser";
import {
  reconcileInvoice,
  type ReconciliationReport,
  type SystemInvoiceEntry,
} from "../lib/invoiceReconciliation";

type Props = {
  open: boolean;
  monthLabel: string;
  systemItems: SystemInvoiceEntry[];
  onClose: () => void;
  onCreateMissingEntry?: (entry: NubankEntry) => void;
  onEditSystemEntry?: (entry: SystemInvoiceEntry) => void;
  onDeleteSystemEntry?: (entry: SystemInvoiceEntry) => void;
};

type DifferenceItem = {
  id: string;
  priority: number;
  title: string;
  amount: number;
  description: string;
  detail?: string;
  tone: "red" | "yellow" | "orange" | "purple";
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

const systemDescription = (entry: SystemInvoiceEntry) =>
  `${entry.category || "Lançamento"}${entry.note ? ` - ${entry.note}` : ""}`;

const toneClassName = (tone: DifferenceItem["tone"]) => {
  if (tone === "red") return "border-red-500/25 bg-red-500/10";
  if (tone === "orange") return "border-orange-500/25 bg-orange-500/10";
  if (tone === "purple") return "border-purple-500/25 bg-purple-500/10";

  return "border-yellow-500/25 bg-yellow-500/10";
};

const amountClassName = (tone: DifferenceItem["tone"]) => {
  if (tone === "orange") return "text-orange-300";
  if (tone === "yellow") return "text-yellow-300";
  if (tone === "purple") return "text-purple-300";

  return "text-red-300";
};

const buildOtherDifferenceItems = (report: ReconciliationReport) => {
  const items: DifferenceItem[] = [];

  report.duplicates.forEach((duplicate, index) => {
    items.push({
      id: `duplicate-${index}`,
      priority: 2,
      title: "Possível duplicidade",
      amount: duplicate.potentialDuplicateValue,
      description: `Valor ${formatMoney(duplicate.value)} aparece ${duplicate.nubankCount}x no Nubank e ${duplicate.systemCount}x no sistema.`,
      detail:
        duplicate.systemEntries.length > duplicate.nubankEntries.length
          ? "Pode haver lançamento duplicado no sistema."
          : "Pode haver lançamento faltando no sistema.",
      tone: "red",
    });
  });

  report.valueDifferences.forEach((match) => {
    items.push({
      id: `value-${match.nubank.id}-${match.system.id}`,
      priority: 4,
      title: "Possível diferença de valor",
      amount: match.valueDifference,
      description: `${match.nubank.title} x ${systemDescription(match.system)}`,
      detail: `Nubank ${formatMoney(match.nubank.amount)} | Sistema ${formatMoney(match.system.value)}`,
      tone: "orange",
    });
  });

  report.reviewMatches.forEach((match) => {
    if (match.hasValueDifference) return;

    items.push({
      id: `review-${match.nubank.id}-${match.system.id}`,
      priority: 5,
      title: "Correspondência para revisar",
      amount: match.nubank.amount,
      description: `${match.nubank.title} x ${systemDescription(match.system)}`,
      detail: `Score ${match.score}% - ${match.reasons
        .map((reason) => reason.text)
        .join("; ")}`,
      tone: "yellow",
    });
  });

  report.dateDifferences.forEach((match) => {
    if (match.confidence !== "high") return;

    items.push({
      id: `date-${match.nubank.id}-${match.system.id}`,
      priority: 6,
      title: "Data diferente",
      amount: match.nubank.amount,
      description: `${match.nubank.title} x ${systemDescription(match.system)}`,
      detail: `Nubank ${formatDate(match.nubank.date)} | Sistema ${formatDate(
        match.system.date,
      )}`,
      tone: "yellow",
    });
  });

  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return Math.abs(b.amount) - Math.abs(a.amount);
  });
};

const DifferenceCard = ({
  item,
  action,
  onAmountClick,
}: {
  item: DifferenceItem;
  action?: ReactNode;
  onAmountClick?: () => void;
}) => (
  <div className={`rounded-xl border p-4 ${toneClassName(item.tone)}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-semibold text-zinc-100">{item.title}</div>
        <div className="mt-1 text-sm text-zinc-300">{item.description}</div>
        {item.detail && (
          <div className="mt-1 text-xs text-zinc-400">{item.detail}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center self-center gap-3">
        {onAmountClick ? (
          <button
            type="button"
            onClick={onAmountClick}
            className={`text-right font-bold transition hover:underline ${amountClassName(
              item.tone,
            )}`}
          >
            {formatMoney(item.amount)}
          </button>
        ) : (
          <div className={`text-right font-bold ${amountClassName(item.tone)}`}>
            {formatMoney(item.amount)}
          </div>
        )}
        {action}
      </div>
    </div>
  </div>
);

const EmptyColumn = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-500">
    {text}
  </div>
);

export default function InvoiceReconciliationModal({
  open,
  monthLabel,
  systemItems,
  onClose,
  onCreateMissingEntry,
  onEditSystemEntry,
  onDeleteSystemEntry,
}: Props) {
  const [nubankEntries, setNubankEntries] = useState<NubankEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const report = useMemo<ReconciliationReport | null>(() => {
    if (!nubankEntries.length) return null;

    return reconcileInvoice(nubankEntries, systemItems);
  }, [nubankEntries, systemItems]);

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
      setNubankEntries(parsed.entries);
      setFileName(file.name);
      toast.success("CSV processado com sucesso.");
    } catch (error) {
      console.error("Erro ao conciliar fatura:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel processar o CSV.",
      );
    }
  };

  const otherDifferences = report ? buildOtherDifferenceItems(report) : [];
  const pendingCount = report
    ? report.missingInSystem.length +
      report.missingInNubank.length +
      otherDifferences.length
    : 0;
  return (
    <div className="fixed inset-0 z-[70] bg-black/75 px-4 py-6">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
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

        <div className="category-scroll flex-1 overflow-y-auto p-5">
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
            className={`mb-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed p-5 transition ${
              isDragging
                ? "border-purple-400 bg-purple-500/10"
                : "border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <FileUp className="text-purple-300" size={26} />
              <div>
                <div className="font-semibold">CSV do Nubank</div>
                <div className="text-sm text-zinc-400">
                  {fileName || "Arraste aqui ou selecione o arquivo"}
                </div>
              </div>
            </div>
            <span className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold">
              Selecionar arquivo
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => processFile(event.target.files?.[0])}
            />
          </label>

          {!report ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
              Nenhum dado será alterado. A conciliação apenas compara o CSV com
              os lançamentos que já aparecem nesta fatura.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="text-xs text-zinc-500">Nubank comparado</div>
                  <div className="mt-1 text-xl font-bold">
                    {formatMoney(report.totals.nubankConciliable)}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="text-xs text-zinc-500">Sistema</div>
                  <div className="mt-1 text-xl font-bold">
                    {formatMoney(report.totals.system)}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <div className="text-xs text-zinc-500">Diferença</div>
                  <div className="mt-1 text-xl font-bold text-purple-300">
                    {formatMoney(report.totals.difference)}
                  </div>
                </div>
              </div>

              {pendingCount === 0 ? (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-sm text-green-100">
                  Não encontrei diferença entre os lançamentos conciliáveis do
                  Nubank e os lançamentos desta fatura no sistema.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-zinc-100">
                          Não lançado no sistema
                        </h4>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          {report.missingInSystem.length}
                        </span>
                      </div>

                      {report.missingInSystem.length === 0 ? (
                        <EmptyColumn text="Nada do Nubank ficou sem lançamento no sistema." />
                      ) : (
                        <div className="category-scroll max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                          {report.missingInSystem.map((entry) => (
                            <DifferenceCard
                              key={entry.id}
                              item={{
                                id: `missing-system-${entry.id}`,
                                priority: 3,
                                title: "Lançamento não realizado",
                                amount: entry.amount,
                                description: `${formatDate(entry.date)} - ${entry.title}`,
                                tone: "red",
                              }}
                              action={
                                onCreateMissingEntry && entry.amount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => onCreateMissingEntry(entry)}
                                    className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-purple-200"
                                    aria-label="Lançar no sistema"
                                    title="Lançar no sistema"
                                  >
                                    <FilePlus2 size={19} />
                                  </button>
                                ) : null
                              }
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-zinc-100">
                          Não existe no Nubank
                        </h4>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          {report.missingInNubank.length}
                        </span>
                      </div>

                      {report.missingInNubank.length === 0 ? (
                        <EmptyColumn text="Nenhum lançamento do sistema ficou sem par no Nubank." />
                      ) : (
                        <div className="category-scroll max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                          {report.missingInNubank.map((entry) => (
                            <DifferenceCard
                              key={entry.id}
                              item={{
                                id: `missing-nubank-${entry.id}`,
                                priority: 3,
                                title: "Não existe no Nubank",
                                amount: entry.value,
                                description: `${formatDate(entry.date)} - ${systemDescription(entry)}`,
                                tone: "orange",
                              }}
                              action={
                                onDeleteSystemEntry ? (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSystemEntry(entry)}
                                    className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-red-300"
                                    aria-label="Excluir lançamento"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                ) : null
                              }
                              onAmountClick={
                                onEditSystemEntry
                                  ? () => onEditSystemEntry(entry)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  {otherDifferences.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-zinc-100">
                          Outros pontos para revisar
                        </h4>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                          {otherDifferences.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {otherDifferences.map((item) => (
                          <DifferenceCard key={item.id} item={item} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
