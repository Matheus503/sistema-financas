import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { SavedInvoiceImport } from "../contracts";
import type { NubankEntry } from "../../../lib/nubankCsvParser";

const getInvoiceImportRef = (
  monthId: string,
  creditCardId: string,
  firestore: Firestore,
) => doc(firestore, "months", monthId, "invoiceImports", creditCardId);

const normalizeKeyText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const amountKey = (amount: number) => Math.round(Number(amount || 0) * 100);

const getEntryBaseKey = (entry: NubankEntry) =>
  [
    entry.date,
    normalizeKeyText(entry.title),
    amountKey(entry.amount),
    entry.installmentCurrent || "",
    entry.installmentTotal || "",
  ].join("|");

const applyReconciliationKeys = (entries: NubankEntry[]) => {
  const occurrences = new Map<string, number>();

  return entries.map((entry) => {
    const baseKey = getEntryBaseKey(entry);
    const occurrence = (occurrences.get(baseKey) || 0) + 1;
    occurrences.set(baseKey, occurrence);

    return {
      ...entry,
      reconciliationKey: `${baseKey}|${occurrence}`,
    };
  });
};

const sanitizeEntry = (entry: NubankEntry): NubankEntry => ({
  id: entry.id,
  reconciliationKey: entry.reconciliationKey || getEntryBaseKey(entry),
  lineNumber: entry.lineNumber,
  date: entry.date,
  title: entry.title,
  amount: Number(entry.amount || 0),
  rawAmount: entry.rawAmount,
  kind: entry.kind,
  conciliable: entry.conciliable,
  ...(entry.installmentCurrent
    ? { installmentCurrent: entry.installmentCurrent }
    : {}),
  ...(entry.installmentTotal
    ? { installmentTotal: entry.installmentTotal }
    : {}),
});

const calculateTotals = (entries: NubankEntry[]) => {
  const gross = entries.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0,
  );
  const conciliable = entries
    .filter((entry) => entry.conciliable)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return {
    gross: Number(gross.toFixed(2)),
    conciliable: Number(conciliable.toFixed(2)),
    excluded: Number((gross - conciliable).toFixed(2)),
  };
};

export const getSavedInvoiceImport = async (
  monthId: string,
  creditCardId: string,
  firestore: Firestore,
) => {
  const snap = await getDoc(getInvoiceImportRef(monthId, creditCardId, firestore));

  if (!snap.exists()) return null;

  const data = snap.data() as SavedInvoiceImport;
  const entries = applyReconciliationKeys(data.entries || []);

  return {
    ...data,
    entries,
    ignoredEntryKeys: data.ignoredEntryKeys || [],
    ignoredSystemEntryKeys: data.ignoredSystemEntryKeys || [],
    totals: data.totals || calculateTotals(entries),
  };
};

export const saveInvoiceImport = async ({
  monthId,
  creditCardId,
  fileName,
  importedBy,
  rawLineCount,
  headers,
  entries,
  firestore,
}: {
  monthId: string;
  creditCardId: string;
  fileName: string;
  importedBy?: string;
  rawLineCount: number;
  headers: string[];
  entries: NubankEntry[];
  firestore: Firestore;
}) => {
  const existingImport =
    monthId && creditCardId
      ? await getSavedInvoiceImport(monthId, creditCardId, firestore)
      : null;
  const entriesWithKeys = applyReconciliationKeys(entries);
  const sanitizedEntries = entriesWithKeys.map(sanitizeEntry);

  const payload = {
    monthId,
    creditCardId,
    source: "nubank" as const,
    fileName,
    importedBy: importedBy || "",
    importedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    rawLineCount,
    headers,
    entries: sanitizedEntries,
    ignoredEntryKeys: existingImport?.ignoredEntryKeys || [],
    ignoredSystemEntryKeys: existingImport?.ignoredSystemEntryKeys || [],
    totals: calculateTotals(sanitizedEntries),
  };

  await setDoc(getInvoiceImportRef(monthId, creditCardId, firestore), payload);

  return {
    ...payload,
    importedAt: new Date(),
    updatedAt: new Date(),
  };
};

export const updateIgnoredSystemEntryKeys = async (
  monthId: string,
  creditCardId: string,
  ignoredSystemEntryKeys: string[],
  firestore: Firestore,
) => {
  await setDoc(
    getInvoiceImportRef(monthId, creditCardId, firestore),
    {
      ignoredSystemEntryKeys,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const updateIgnoredInvoiceEntryKeys = async (
  monthId: string,
  creditCardId: string,
  ignoredEntryKeys: string[],
  firestore: Firestore,
) => {
  await setDoc(
    getInvoiceImportRef(monthId, creditCardId, firestore),
    {
      ignoredEntryKeys,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};
