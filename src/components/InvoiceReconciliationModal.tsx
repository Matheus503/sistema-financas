"use client";

import { FilePlus2, FileUp, Flag, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { auth } from "../lib/auth";
import { parseNubankCsv, type NubankEntry } from "../lib/nubankCsvParser";
import {
  reconcileInvoice,
  type ReconciliationReport,
  type SystemInvoiceEntry,
} from "../lib/invoiceReconciliation";
import {
  getSavedInvoiceImport,
  saveInvoiceImport,
  type SavedInvoiceImport,
  updateIgnoredInvoiceEntryKeys,
  updateIgnoredSystemEntryKeys,
} from "../services/invoiceImportService";

type Props = {
  open: boolean;
  monthLabel: string;
  monthId?: string | null;
  creditCardId?: string;
  systemItems: SystemInvoiceEntry[];
  onClose: () => void;
  onCreateMissingEntry?: (entry: NubankEntry) => void;
  onEditSystemEntry?: (entry: SystemInvoiceEntry) => void;
  onDeleteSystemEntry?: (entry: SystemInvoiceEntry) => void;
};

type DifferenceItem = {
  title: string;
  amount: number;
  description: string;
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

const formatImportedAt = (value: unknown) => {
  if (!value) return "";

  const maybeTimestamp = value as { toDate?: () => Date };
  const date =
    typeof maybeTimestamp.toDate === "function"
      ? maybeTimestamp.toDate()
      : value instanceof Date
        ? value
        : null;

  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const systemDescription = (entry: SystemInvoiceEntry) =>
  `${entry.category || "Lançamento"}${entry.note ? ` - ${entry.note}` : ""}`;

const getSystemEntryKey = (entry: SystemInvoiceEntry) =>
  [entry.monthId || "", entry.transactionId || entry.id].join("|");

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

const DifferenceCard = ({
  item,
  action,
  cornerAction,
  onAmountClick,
}: {
  item: DifferenceItem;
  action?: ReactNode;
  cornerAction?: ReactNode;
  onAmountClick?: () => void;
}) => (
  <div
    className={`relative rounded-xl border p-4 ${cornerAction ? "pl-12" : ""} ${toneClassName(
      item.tone,
    )}`}
  >
    {cornerAction && (
      <div className="absolute left-1 top-1">{cornerAction}</div>
    )}
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-semibold text-zinc-100">{item.title}</div>
        <div className="mt-1 text-sm text-zinc-300">{item.description}</div>
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
  monthId,
  creditCardId,
  systemItems,
  onClose,
  onCreateMissingEntry,
  onEditSystemEntry,
  onDeleteSystemEntry,
}: Props) {
  const [nubankEntries, setNubankEntries] = useState<NubankEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingImport, setIsLoadingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [showIgnoredEntries, setShowIgnoredEntries] = useState(false);
  const [showIgnoredSystemEntries, setShowIgnoredSystemEntries] =
    useState(false);
  const [savedImport, setSavedImport] = useState<SavedInvoiceImport | null>(
    null,
  );

  const ignoredEntryKeys = useMemo(
    () => new Set(savedImport?.ignoredEntryKeys || []),
    [savedImport?.ignoredEntryKeys],
  );
  const ignoredSystemEntryKeys = useMemo(
    () => new Set(savedImport?.ignoredSystemEntryKeys || []),
    [savedImport?.ignoredSystemEntryKeys],
  );
  const activeNubankEntries = useMemo(
    () =>
      nubankEntries.filter(
        (entry) =>
          !entry.reconciliationKey ||
          !ignoredEntryKeys.has(entry.reconciliationKey),
      ),
    [ignoredEntryKeys, nubankEntries],
  );
  const ignoredNubankEntries = useMemo(
    () =>
      nubankEntries.filter(
        (entry) =>
          entry.conciliable &&
          entry.reconciliationKey &&
          ignoredEntryKeys.has(entry.reconciliationKey),
      ),
    [ignoredEntryKeys, nubankEntries],
  );
  const activeSystemItems = useMemo(
    () =>
      systemItems.filter(
        (entry) => !ignoredSystemEntryKeys.has(getSystemEntryKey(entry)),
      ),
    [ignoredSystemEntryKeys, systemItems],
  );
  const ignoredSystemEntries = useMemo(
    () =>
      systemItems.filter((entry) =>
        ignoredSystemEntryKeys.has(getSystemEntryKey(entry)),
      ),
    [ignoredSystemEntryKeys, systemItems],
  );

  const report = useMemo<ReconciliationReport | null>(() => {
    if (!nubankEntries.length) return null;

    return reconcileInvoice(activeNubankEntries, activeSystemItems);
  }, [activeNubankEntries, activeSystemItems, nubankEntries.length]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadSavedImport = async () => {
      if (!monthId || !creditCardId) {
        setNubankEntries([]);
        setFileName("");
        setSavedImport(null);
        return;
      }

      setIsLoadingImport(true);

      try {
        const currentImport = await getSavedInvoiceImport(
          monthId,
          creditCardId,
        );
        if (!isMounted) return;

        setSavedImport(currentImport);
        setNubankEntries(currentImport?.entries || []);
        setFileName(currentImport?.fileName || "");
      } catch (error) {
        console.error("Erro ao carregar importação da fatura:", error);

        if (isMounted) {
          setSavedImport(null);
          setNubankEntries([]);
          setFileName("");
          toast.error("Não foi possível carregar a última importação.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingImport(false);
        }
      }
    };

    loadSavedImport();

    return () => {
      isMounted = false;
    };
  }, [creditCardId, monthId, open]);

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
      let nextSavedImport: SavedInvoiceImport | null = null;

      if (monthId && creditCardId) {
        setIsSavingImport(true);
        nextSavedImport = await saveInvoiceImport({
          monthId,
          creditCardId,
          fileName: file.name,
          importedBy: auth.currentUser?.uid || "",
          rawLineCount: parsed.rawLineCount,
          headers: parsed.headers,
          entries: parsed.entries,
        });
      }

      setNubankEntries(nextSavedImport?.entries || parsed.entries);
      setFileName(file.name);
      setSavedImport(nextSavedImport);
      setShowIgnoredEntries(false);
      setShowIgnoredSystemEntries(false);
      toast.success(
        monthId && creditCardId
          ? "CSV importado e salvo com sucesso."
          : "CSV processado com sucesso.",
      );
    } catch (error) {
      console.error("Erro ao conciliar fatura:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel processar o CSV.",
      );
    } finally {
      setIsSavingImport(false);
    }
  };

  const toggleIgnoredEntry = async (entry: NubankEntry) => {
    if (!entry.reconciliationKey) {
      toast.error("Não foi possível identificar este lançamento no CSV.");
      return;
    }

    if (!monthId || !creditCardId) {
      toast.error("Abra uma fatura de cartão para salvar este ajuste.");
      return;
    }

    const currentKeys = savedImport?.ignoredEntryKeys || [];
    const isIgnored = currentKeys.includes(entry.reconciliationKey);
    const nextKeys = isIgnored
      ? currentKeys.filter((key) => key !== entry.reconciliationKey)
      : [...currentKeys, entry.reconciliationKey];
    const previousImport = savedImport;

    setSavedImport((current) =>
      current
        ? {
            ...current,
            ignoredEntryKeys: nextKeys,
          }
        : current,
    );

    try {
      await updateIgnoredInvoiceEntryKeys(monthId, creditCardId, nextKeys);
      toast.success(
        isIgnored
          ? "Lançamento voltou para a conciliação."
          : "Lançamento ignorado na conciliação.",
      );
    } catch (error) {
      console.error("Erro ao atualizar lançamento ignorado:", error);
      setSavedImport(previousImport);
      toast.error("Não foi possível salvar este ajuste.");
    }
  };

  const toggleIgnoredSystemEntry = async (entry: SystemInvoiceEntry) => {
    if (!monthId || !creditCardId) {
      toast.error("Abra uma fatura de cartão para salvar este ajuste.");
      return;
    }

    const entryKey = getSystemEntryKey(entry);
    const currentKeys = savedImport?.ignoredSystemEntryKeys || [];
    const isIgnored = currentKeys.includes(entryKey);
    const nextKeys = isIgnored
      ? currentKeys.filter((key) => key !== entryKey)
      : [...currentKeys, entryKey];
    const previousImport = savedImport;

    setSavedImport((current) =>
      current
        ? {
            ...current,
            ignoredSystemEntryKeys: nextKeys,
          }
        : current,
    );

    try {
      await updateIgnoredSystemEntryKeys(monthId, creditCardId, nextKeys);
      toast.success(
        isIgnored
          ? "Lançamento voltou para a conciliação."
          : "Lançamento ignorado na conciliação.",
      );
    } catch (error) {
      console.error("Erro ao atualizar lançamento ignorado do sistema:", error);
      setSavedImport(previousImport);
      toast.error("Não foi possível salvar este ajuste.");
    }
  };

  const pendingCount = report
    ? report.missingInSystem.length + report.missingInNubank.length
    : 0;
  const savedImportDate = formatImportedAt(savedImport?.importedAt);
  const canProcessFile = !isLoadingImport && !isSavingImport;

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

        <div className="flex min-h-0 flex-1 flex-col p-5">
          <label
            onDragOver={(event) => {
              if (!canProcessFile) return;
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              if (!canProcessFile) return;
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
                  {isLoadingImport
                    ? "Carregando última importação..."
                    : fileName || "Arraste aqui ou selecione o arquivo"}
                </div>
                {savedImport && savedImportDate && (
                  <div className="mt-1 text-xs text-zinc-500">
                    Última importação: {savedImportDate}
                  </div>
                )}
              </div>
            </div>
            <span
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                canProcessFile ? "bg-purple-600" : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {isSavingImport
                ? "Salvando..."
                : savedImport
                  ? "Substituir arquivo"
                  : "Selecionar arquivo"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={!canProcessFile}
              onChange={(event) => processFile(event.target.files?.[0])}
            />
          </label>

          {isLoadingImport ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
              Carregando a última importação salva desta fatura.
            </div>
          ) : !report ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
              Nenhuma importação salva para esta fatura. Selecione o CSV do
              Nubank para iniciar a conciliação.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden space-y-5">
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

              {pendingCount === 0 &&
              ignoredNubankEntries.length === 0 &&
              ignoredSystemEntries.length === 0 ? (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-sm text-green-100">
                  Não encontrei diferença entre os lançamentos conciliáveis do
                  Nubank e os lançamentos desta fatura no sistema.
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
                    <section className="flex min-h-0 flex-col space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-zinc-100">
                          Não lançado no sistema
                        </h4>
                        <div className="flex items-center gap-2">
                          {ignoredNubankEntries.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowIgnoredEntries((current) => !current)
                              }
                              className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/20"
                            >
                              {showIgnoredEntries ? "Ocultar" : "Ignorados"}{" "}
                              {ignoredNubankEntries.length}
                            </button>
                          )}
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {report.missingInSystem.length}
                          </span>
                        </div>
                      </div>

                      {report.missingInSystem.length === 0 &&
                      (!showIgnoredEntries ||
                        ignoredNubankEntries.length === 0) ? (
                        <EmptyColumn text="Nada do Nubank ficou sem lançamento no sistema." />
                      ) : (
                        <div className="category-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                          {report.missingInSystem.map((entry) => (
                            <DifferenceCard
                              key={entry.reconciliationKey || entry.id}
                              item={{
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
                              cornerAction={
                                <button
                                  type="button"
                                  onClick={() => toggleIgnoredEntry(entry)}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-purple-500/10 hover:text-purple-200"
                                  aria-label="Ignorar lançamento"
                                  title="Ignorar lançamento"
                                >
                                  <Flag size={17} />
                                </button>
                              }
                            />
                          ))}
                          {showIgnoredEntries &&
                            ignoredNubankEntries.map((entry) => (
                              <DifferenceCard
                                key={`ignored-${entry.reconciliationKey || entry.id}`}
                                item={{
                                  title: "Lançamento não realizado",
                                  amount: entry.amount,
                                  description: `${formatDate(entry.date)} - ${entry.title}`,
                                  tone: "purple",
                                }}
                                cornerAction={
                                  <button
                                    type="button"
                                    onClick={() => toggleIgnoredEntry(entry)}
                                    className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/15 text-purple-200 transition hover:bg-purple-500/25"
                                    aria-label="Voltar para a conciliação"
                                    title="Voltar para a conciliação"
                                  >
                                    <Flag size={17} fill="currentColor" />
                                  </button>
                                }
                              />
                            ))}
                        </div>
                      )}
                    </section>

                    <section className="flex min-h-0 flex-col space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-zinc-100">
                          Não existe no Nubank
                        </h4>
                        <div className="flex items-center gap-2">
                          {ignoredSystemEntries.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowIgnoredSystemEntries(
                                  (current) => !current,
                                )
                              }
                              className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/20"
                            >
                              {showIgnoredSystemEntries
                                ? "Ocultar"
                                : "Ignorados"}{" "}
                              {ignoredSystemEntries.length}
                            </button>
                          )}
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                            {report.missingInNubank.length}
                          </span>
                        </div>
                      </div>

                      {report.missingInNubank.length === 0 &&
                      (!showIgnoredSystemEntries ||
                        ignoredSystemEntries.length === 0) ? (
                        <EmptyColumn text="Nenhum lançamento do sistema ficou sem par no Nubank." />
                      ) : (
                        <div className="category-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                          {report.missingInNubank.map((entry) => (
                            <DifferenceCard
                              key={entry.id}
                              item={{
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
                              cornerAction={
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleIgnoredSystemEntry(entry)
                                  }
                                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-purple-500/10 hover:text-purple-200"
                                  aria-label="Ignorar lançamento"
                                  title="Ignorar lançamento"
                                >
                                  <Flag size={17} />
                                </button>
                              }
                              onAmountClick={
                                onEditSystemEntry
                                  ? () => onEditSystemEntry(entry)
                                  : undefined
                              }
                            />
                          ))}
                          {showIgnoredSystemEntries &&
                            ignoredSystemEntries.map((entry) => (
                              <DifferenceCard
                                key={`ignored-system-${getSystemEntryKey(entry)}`}
                                item={{
                                  title: "Não existe no Nubank",
                                  amount: entry.value,
                                  description: `${formatDate(entry.date)} - ${systemDescription(entry)}`,
                                  tone: "purple",
                                }}
                                cornerAction={
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleIgnoredSystemEntry(entry)
                                    }
                                    className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/15 text-purple-200 transition hover:bg-purple-500/25"
                                    aria-label="Voltar para a conciliação"
                                    title="Voltar para a conciliação"
                                  >
                                    <Flag size={17} fill="currentColor" />
                                  </button>
                                }
                              />
                            ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
