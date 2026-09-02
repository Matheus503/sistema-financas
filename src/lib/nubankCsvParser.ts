export type NubankEntryKind =
  | "expense"
  | "credit_refund"
  | "invoice_payment"
  | "discount"
  | "other";

export type NubankEntry = {
  id: string;
  lineNumber: number;
  date: string;
  title: string;
  amount: number;
  rawAmount: string;
  kind: NubankEntryKind;
  conciliable: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
};

export type NubankParseResult = {
  entries: NubankEntry[];
  headers: string[];
  rawLineCount: number;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const normalizeRow = (line: string) => {
  let row = parseCsvLine(line);

  if (row.length === 1) {
    row = parseCsvLine(row[0]);
  }

  if (row.length > 3) {
    return [row[0], row.slice(1, -1).join(",").trim(), row[row.length - 1]];
  }

  return row;
};

const parseAmount = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor invalido no CSV do Nubank: ${value}`);
  }

  return parsed;
};

const classifyEntry = (title: string, amount: number): NubankEntryKind => {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (/pagamento/.test(normalized)) return "invoice_payment";
  if (/desconto|antecipacao/.test(normalized)) return "discount";
  if (/estorno|credito|cancelamento|reembolso/.test(normalized)) {
    return "credit_refund";
  }
  if (amount < 0) return "credit_refund";

  return "expense";
};

const parseInstallment = (title: string) => {
  const match = title.match(/parcela\s+(\d+)\s*\/\s*(\d+)/i);

  if (!match) return {};

  return {
    installmentCurrent: Number(match[1]),
    installmentTotal: Number(match[2]),
  };
};

const isConciliable = (kind: NubankEntryKind) => kind !== "invoice_payment";

export const parseNubankCsv = (csvText: string): NubankParseResult => {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV vazio.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());

  if (
    normalizedHeaders[0] !== "date" ||
    normalizedHeaders[1] !== "title" ||
    normalizedHeaders[2] !== "amount"
  ) {
    throw new Error(
      "Formato invalido. O CSV do Nubank deve conter as colunas date,title,amount."
    );
  }

  const entries = lines.slice(1).map((line, index) => {
    const lineNumber = index + 2;
    const [date = "", title = "", rawAmount = ""] = normalizeRow(line);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Data invalida na linha ${lineNumber}: ${date}`);
    }

    const amount = parseAmount(rawAmount);
    const trimmedTitle = title.trim();
    const kind = classifyEntry(trimmedTitle, amount);

    return {
      id: `nubank-${lineNumber}`,
      lineNumber,
      date,
      title: trimmedTitle,
      amount,
      rawAmount,
      kind,
      conciliable: isConciliable(kind),
      ...parseInstallment(trimmedTitle),
    };
  });

  return {
    entries,
    headers,
    rawLineCount: lines.length,
  };
};
