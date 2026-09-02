import type { NubankEntry } from "./nubankCsvParser";

export type SystemInvoiceEntry = {
  id: string;
  transactionId: string;
  monthId?: string;
  date: string;
  value: number;
  category?: string;
  note?: string;
  accountName?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  transactionType?: string;
};

export type ScoreReasonTone = "positive" | "warning" | "negative" | "neutral";

export type ScoreReason = {
  tone: ScoreReasonTone;
  text: string;
};

export type MatchConfidence = "high" | "review" | "low";

export type MatchCandidate = {
  nubank: NubankEntry;
  system: SystemInvoiceEntry;
  score: number;
  confidence: MatchConfidence;
  reasons: ScoreReason[];
  dateDifferenceDays: number | null;
  valueDifference: number;
  hasDateDifference: boolean;
  hasValueDifference: boolean;
  hasInstallmentDifference: boolean;
};

export type DuplicateIssue = {
  value: number;
  nubankCount: number;
  systemCount: number;
  potentialDuplicateValue: number;
  nubankEntries: NubankEntry[];
  systemEntries: SystemInvoiceEntry[];
};

export type ReconciliationReport = {
  totals: {
    nubankGross: number;
    nubankConciliable: number;
    nubankExcluded: number;
    system: number;
    difference: number;
    explained: number;
    residual: number;
  };
  audit: {
    nubankTotal: number;
    nubankConciliable: number;
    matched: number;
    missingInSystem: number;
    missingInNubank: number;
    duplicates: number;
    valueDifferences: number;
    dateDifferences: number;
    reviewMatches: number;
  };
  status: "conciliated" | "partially_conciliated" | "not_conciliated";
  matches: MatchCandidate[];
  reviewMatches: MatchCandidate[];
  dateDifferences: MatchCandidate[];
  valueDifferences: MatchCandidate[];
  missingInSystem: NubankEntry[];
  missingInNubank: SystemInvoiceEntry[];
  duplicates: DuplicateIssue[];
  excludedNubankEntries: NubankEntry[];
};

const cents = (value: number) => Math.round(Number(value || 0) * 100);

const fromCents = (value: number) => Number((value / 100).toFixed(2));

export const normalizeComparableText = (value: string) => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const synonyms: Record<string, string> = {
    pedagio: "tag",
    pedagios: "tag",
    nutag: "tag",
    tag: "tag",
    uber: "transporte",
    "99": "transporte",
    supermercado: "mercado",
    alimentacao: "comida",
    farmacia: "drogaria",
  };

  return normalized
    .split(" ")
    .map((token) => synonyms[token] || token)
    .join(" ");
};

const tokenSet = (value: string) =>
  new Set(
    normalizeComparableText(value)
      .split(" ")
      .filter((token) => token.length >= 2),
  );

const textSimilarity = (left: string, right: string) => {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getDateDifferenceDays = (left: string, right: string) => {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);

  if (!leftDate || !rightDate) return null;

  return Math.round(
    Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000,
  );
};

const systemText = (entry: SystemInvoiceEntry) =>
  `${entry.category || ""} ${entry.note || ""} ${entry.accountName || ""}`;

const getConfidence = (score: number): MatchConfidence => {
  if (score >= 90) return "high";
  if (score >= 70) return "review";
  return "low";
};

const scorePair = (
  nubank: NubankEntry,
  system: SystemInvoiceEntry,
): MatchCandidate => {
  const reasons: ScoreReason[] = [];
  let score = 0;

  const valueDifferenceCents = Math.abs(
    cents(nubank.amount) - cents(system.value),
  );
  const valueDifference = fromCents(valueDifferenceCents);

  if (valueDifferenceCents === 0) {
    score += 55;
    reasons.push({ tone: "positive", text: "Valor exato" });
  } else if (valueDifferenceCents <= 500) {
    score += 35;
    reasons.push({
      tone: "warning",
      text: `Valor proximo, diferenca de R$ ${valueDifference.toFixed(2)}`,
    });
  } else {
    reasons.push({
      tone: "negative",
      text: `Valor diferente, diferenca de R$ ${valueDifference.toFixed(2)}`,
    });
  }

  const similarity = Math.max(
    textSimilarity(nubank.title, systemText(system)),
    textSimilarity(nubank.title, system.category || ""),
    textSimilarity(nubank.title, system.note || ""),
  );

  if (similarity >= 0.45) {
    score += 25;
    reasons.push({ tone: "positive", text: "Descricao/categoria semelhante" });
  } else if (similarity >= 0.18) {
    score += 14;
    reasons.push({
      tone: "warning",
      text: "Descricao/categoria parcialmente semelhante",
    });
  } else {
    reasons.push({
      tone: "warning",
      text: "Descricao pouco semelhante",
    });
  }

  const dateDifferenceDays = getDateDifferenceDays(nubank.date, system.date);

  if (dateDifferenceDays === 0) {
    score += 15;
    reasons.push({ tone: "positive", text: "Mesma data" });
  } else if (dateDifferenceDays !== null && dateDifferenceDays <= 2) {
    score += 10;
    reasons.push({
      tone: "warning",
      text: `Data diferente em ${dateDifferenceDays} dia(s)`,
    });
  } else if (dateDifferenceDays !== null && dateDifferenceDays <= 7) {
    score += 5;
    reasons.push({
      tone: "warning",
      text: `Data distante em ${dateDifferenceDays} dia(s)`,
    });
  } else {
    reasons.push({ tone: "neutral", text: "Data nao ajudou no matching" });
  }

  const nubankHasInstallment = Boolean(
    nubank.installmentCurrent && nubank.installmentTotal,
  );
  const systemHasInstallment = Boolean(
    system.installmentCurrent && system.installmentTotal,
  );
  const hasInstallmentDifference =
    nubankHasInstallment &&
    systemHasInstallment &&
    (nubank.installmentCurrent !== system.installmentCurrent ||
      nubank.installmentTotal !== system.installmentTotal);

  if (nubankHasInstallment && systemHasInstallment) {
    if (!hasInstallmentDifference) {
      score += 5;
      reasons.push({ tone: "positive", text: "Parcela compativel" });
    } else {
      score -= 10;
      reasons.push({
        tone: "negative",
        text: "Parcela possivelmente incorreta",
      });
    }
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    nubank,
    system,
    score: boundedScore,
    confidence: getConfidence(boundedScore),
    reasons,
    dateDifferenceDays,
    valueDifference,
    hasDateDifference: Boolean(dateDifferenceDays && dateDifferenceDays > 0),
    hasValueDifference: valueDifferenceCents > 0 && valueDifferenceCents <= 500,
    hasInstallmentDifference,
  };
};

const sortCandidate = (a: MatchCandidate, b: MatchCandidate) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.valueDifference !== b.valueDifference) {
    return a.valueDifference - b.valueDifference;
  }

  return (a.dateDifferenceDays || 99) - (b.dateDifferenceDays || 99);
};

const findOneToOneMatches = (
  nubankEntries: NubankEntry[],
  systemEntries: SystemInvoiceEntry[],
) => {
  const candidates = nubankEntries
    .flatMap((nubank) =>
      systemEntries.map((system) => scorePair(nubank, system)),
    )
    .filter((candidate) => candidate.score >= 60)
    .sort(sortCandidate);
  const usedNubank = new Set<string>();
  const usedSystem = new Set<string>();
  const matches: MatchCandidate[] = [];

  for (const candidate of candidates) {
    if (usedNubank.has(candidate.nubank.id)) continue;
    if (usedSystem.has(candidate.system.id)) continue;

    usedNubank.add(candidate.nubank.id);
    usedSystem.add(candidate.system.id);
    matches.push(candidate);
  }

  return {
    matches: matches.sort((a, b) => a.nubank.date.localeCompare(b.nubank.date)),
    usedNubank,
    usedSystem,
  };
};

const detectDuplicates = (
  missingInSystem: NubankEntry[],
  missingInNubank: SystemInvoiceEntry[],
) => {
  const byValue = new Map<
    number,
    { nubankEntries: NubankEntry[]; systemEntries: SystemInvoiceEntry[] }
  >();

  for (const entry of missingInSystem) {
    const key = cents(entry.amount);
    const group = byValue.get(key) || { nubankEntries: [], systemEntries: [] };
    group.nubankEntries.push(entry);
    byValue.set(key, group);
  }

  for (const entry of missingInNubank) {
    const key = cents(entry.value);
    const group = byValue.get(key) || { nubankEntries: [], systemEntries: [] };
    group.systemEntries.push(entry);
    byValue.set(key, group);
  }

  return Array.from(byValue.entries())
    .filter(
      ([, group]) =>
        group.nubankEntries.length > 0 &&
        group.systemEntries.length > group.nubankEntries.length,
    )
    .map(([valueCents, group]) => {
      const extraCount = Math.abs(
        group.nubankEntries.length - group.systemEntries.length,
      );

      return {
        value: fromCents(valueCents),
        nubankCount: group.nubankEntries.length,
        systemCount: group.systemEntries.length,
        potentialDuplicateValue: fromCents(extraCount * Math.abs(valueCents)),
        nubankEntries: group.nubankEntries,
        systemEntries: group.systemEntries,
      };
    });
};

const getStatus = (difference: number, residual: number) => {
  const diffCents = Math.abs(cents(difference));
  const residualCents = Math.abs(cents(residual));

  if (diffCents <= 1 || residualCents <= 1) return "conciliated";
  if (residualCents < diffCents) return "partially_conciliated";
  return "not_conciliated";
};

export const reconcileInvoice = (
  nubankEntries: NubankEntry[],
  systemEntries: SystemInvoiceEntry[],
): ReconciliationReport => {
  const conciliableNubankEntries = nubankEntries.filter(
    (entry) => entry.conciliable,
  );
  const excludedNubankEntries = nubankEntries.filter(
    (entry) => !entry.conciliable,
  );
  const { matches, usedNubank, usedSystem } = findOneToOneMatches(
    conciliableNubankEntries,
    systemEntries,
  );

  const missingInSystem = conciliableNubankEntries.filter(
    (entry) => !usedNubank.has(entry.id),
  );
  const missingInNubank = systemEntries.filter(
    (entry) => !usedSystem.has(entry.id),
  );
  const reviewMatches = matches.filter((match) => match.confidence !== "high");
  const dateDifferences = matches.filter((match) => match.hasDateDifference);
  const valueDifferences = matches.filter((match) => match.hasValueDifference);
  const duplicates = detectDuplicates(missingInSystem, missingInNubank);

  const nubankGross = nubankEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const nubankConciliable = conciliableNubankEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const nubankExcluded = excludedNubankEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const system = systemEntries.reduce((sum, entry) => sum + entry.value, 0);
  const difference = system - nubankConciliable;
  const missingInSystemImpact = missingInSystem.reduce(
    (sum, entry) => sum - entry.amount,
    0,
  );
  const missingInNubankImpact = missingInNubank.reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const valueDifferenceImpact = valueDifferences.reduce(
    (sum, match) => sum + (match.system.value - match.nubank.amount),
    0,
  );
  const explained = Number(
    (
      missingInSystemImpact +
      missingInNubankImpact +
      valueDifferenceImpact
    ).toFixed(2),
  );
  const residual = Number((difference - explained).toFixed(2));

  return {
    totals: {
      nubankGross: Number(nubankGross.toFixed(2)),
      nubankConciliable: Number(nubankConciliable.toFixed(2)),
      nubankExcluded: Number(nubankExcluded.toFixed(2)),
      system: Number(system.toFixed(2)),
      difference: Number(difference.toFixed(2)),
      explained,
      residual,
    },
    audit: {
      nubankTotal: nubankEntries.length,
      nubankConciliable: conciliableNubankEntries.length,
      matched: matches.length,
      missingInSystem: missingInSystem.length,
      missingInNubank: missingInNubank.length,
      duplicates: duplicates.length,
      valueDifferences: valueDifferences.length,
      dateDifferences: dateDifferences.length,
      reviewMatches: reviewMatches.length,
    },
    status: getStatus(difference, residual),
    matches,
    reviewMatches,
    dateDifferences,
    valueDifferences,
    missingInSystem,
    missingInNubank,
    duplicates,
    excludedNubankEntries,
  };
};
