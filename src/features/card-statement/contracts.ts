import type { NubankEntry } from "../../lib/nubankCsvParser";

export type SavedInvoiceImport = {
  monthId: string;
  creditCardId: string;
  source: "nubank";
  fileName: string;
  importedBy?: string;
  importedAt?: unknown;
  updatedAt?: unknown;
  rawLineCount: number;
  headers: string[];
  entries: NubankEntry[];
  ignoredEntryKeys: string[];
  ignoredSystemEntryKeys: string[];
  totals: {
    gross: number;
    conciliable: number;
    excluded: number;
  };
};
