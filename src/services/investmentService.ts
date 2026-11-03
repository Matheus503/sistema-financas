import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firestore";

export const INVESTMENT_CATEGORIES = [
  { id: "stocks", label: "Ações brasileiras", defaultTarget: 30 },
  { id: "fiis", label: "FIIs — Fundos Imobiliários", defaultTarget: 25 },
  { id: "etfs", label: "ETFs — Fundos de índice", defaultTarget: 25 },
  { id: "fixed_income", label: "Renda fixa", defaultTarget: 0 },
  { id: "treasury", label: "Tesouro Direto", defaultTarget: 0 },
  { id: "bdrs", label: "BDRs", defaultTarget: 0 },
  { id: "crypto", label: "Criptomoedas", defaultTarget: 0 },
  { id: "funds", label: "Fundos de investimento", defaultTarget: 0 },
  { id: "pension", label: "Previdência privada", defaultTarget: 0 },
  { id: "opportunities", label: "Reserva de oportunidades", defaultTarget: 20 },
] as const;

export type InvestmentCategoryId = string;
export type InvestmentCategory = { id: InvestmentCategoryId; label: string; defaultTarget?: number };
export type InvestmentTargets = Record<InvestmentCategoryId, number>;

export type InvestorSettings = {
  monthlyPlan: number;
  categories: InvestmentCategory[];
  selectedCategoryIds: InvestmentCategoryId[];
  targets: InvestmentTargets;
};

export type InvestmentPurchaseCategory = string;
export type InvestorMovement = {
  id: string;
  type: "purchase" | "reserve" | "contribution";
  year: number;
  month: number;
  monthId: string;
  category?: InvestmentPurchaseCategory;
  asset?: string;
  quantity?: number;
  unitPriceCents?: number;
  additionalCostsCents?: number;
  direction?: "deposit" | "withdrawal";
  description?: string;
  amountCents: number;
};

export type InvestorPortfolioSummary = {
  monthlyCategoryTotalsCents: Record<InvestmentPurchaseCategory, number>;
  monthlyPurchasesCents: number;
  monthlyCashOutflowCents: number;
  reserveBalanceCents: number;
  monthlyReserveDepositsCents: number;
  monthlyReserveWithdrawalsCents: number;
  availableBalanceCents: number;
  freeBalanceCents: number;
  isLatestMonth: boolean;
};

export type InvestmentPurchaseInput = {
  category: InvestmentPurchaseCategory;
  asset: string;
  quantity: number;
  unitPriceCents: number;
  additionalCostsCents: number;
};

export type ReserveMovementInput = {
  direction: "deposit" | "withdrawal";
  amountCents: number;
  description: string;
};


export const DEFAULT_INVESTOR_SETTINGS: InvestorSettings = {
  monthlyPlan: 1000,
  categories: INVESTMENT_CATEGORIES.map((category) => ({ ...category })),
  selectedCategoryIds: ["stocks", "fiis", "etfs", "opportunities"],
  targets: {
    stocks: 30,
    fiis: 25,
    etfs: 25,
    opportunities: 20,
  },
};

const getMonthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export async function getInvestorSettings(
  groupId: string,
  year: number,
  month: number,
): Promise<InvestorSettings> {
  const settingsSnapshot = await getDocs(
    query(collection(db, "settings"), where("groupId", "==", groupId)),
  );

  const selectedKey = getMonthKey(year, month);
  const applicable = settingsSnapshot.docs
    .map((item) => item.data())
    .filter(
      (item) =>
        item.kind === "investor" &&
        typeof item.effectiveMonth === "string" &&
        item.effectiveMonth <= selectedKey,
    )
    .sort((a, b) =>
      String(b.effectiveMonth).localeCompare(String(a.effectiveMonth)),
    )[0];

  if (!applicable) return DEFAULT_INVESTOR_SETTINGS;

  const configuredCategories = Array.isArray(applicable.categories)
    ? applicable.categories.filter((category: unknown): category is InvestmentCategory => !!category && typeof category === "object" && typeof (category as InvestmentCategory).id === "string" && typeof (category as InvestmentCategory).label === "string")
    : [];
  const categories = [...new Map(
    [...DEFAULT_INVESTOR_SETTINGS.categories, ...configuredCategories].map((category) => [category.id, category]),
  ).values()];
  const configuredIds = Array.isArray(applicable.selectedCategoryIds)
    ? applicable.selectedCategoryIds.filter((id: unknown): id is string => typeof id === "string")
    : DEFAULT_INVESTOR_SETTINGS.selectedCategoryIds;
  const selectedCategoryIds = [...new Set([...configuredIds, "opportunities"])];

  return {
    monthlyPlan: Number(applicable.monthlyPlan),
    categories,
    selectedCategoryIds,
    targets: Object.fromEntries(
      categories.map((category) => [category.id, Number(applicable.targets?.[category.id] ?? category.defaultTarget ?? 0)]),
    ),
  };
}

export async function saveInvestorSettings(
  groupId: string,
  year: number,
  month: number,
  settings: InvestorSettings,
) {
  const effectiveMonth = getMonthKey(year, month);
  await setDoc(doc(db, "settings", `${groupId}_investor_${effectiveMonth}`), {
    groupId,
    kind: "investor",
    effectiveMonth,
    monthlyPlan: settings.monthlyPlan,
    categories: settings.categories,
    selectedCategoryIds: settings.selectedCategoryIds,
    targets: settings.targets,
    updatedAt: serverTimestamp(),
  });
}

async function assertMonthExists(
  groupId: string,
  monthId: string,
  year: number,
  month: number,
) {
  if (!monthId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mês de referência inválido.");
  }
  const monthSnapshot = await getDoc(doc(db, "months", monthId));
  const monthData = monthSnapshot.data();
  if (!monthSnapshot.exists() || monthData?.groupId !== groupId || monthData?.year !== year || monthData?.month !== month) {
    throw new Error("O mês selecionado não existe no espaço atual.");
  }
}

async function assertMovementBelongsToMonth(
  groupId: string,
  monthId: string,
  movementId: string,
) {
  const movementSnapshot = await getDoc(doc(db, "investments", movementId));
  const data = movementSnapshot.data();
  if (!movementSnapshot.exists() || data?.kind !== "investor" || data?.groupId !== groupId || data?.monthId !== monthId) {
    throw new Error("A movimentação não pertence ao mês selecionado.");
  }
}

export async function getInvestorPortfolioData(
  groupId: string,
  year: number,
  month: number,
  monthId: string,
): Promise<{
  portfolioMovements: InvestorMovement[];
  summary: InvestorPortfolioSummary;
}> {
  await assertMonthExists(groupId, monthId, year, month);
  const [snapshot, monthsSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "investments"), where("groupId", "==", groupId))),
    getDocs(query(collection(db, "months"), where("groupId", "==", groupId))),
    getDocs(query(collection(db, "settings"), where("groupId", "==", groupId))),
  ]);
  const selectedKey = getMonthKey(year, month);
  const plans = settingsSnapshot.docs.map((item) => item.data())
    .filter((item) => item.kind === "investor" && typeof item.effectiveMonth === "string")
    .map((item) => ({ effectiveMonth: String(item.effectiveMonth), monthlyPlan: Number(item.monthlyPlan) || 0 }))
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
  const summary: InvestorPortfolioSummary = {
    monthlyCategoryTotalsCents: {},
    monthlyPurchasesCents: 0,
    monthlyCashOutflowCents: 0,
    reserveBalanceCents: 0,
    monthlyReserveDepositsCents: 0,
    monthlyReserveWithdrawalsCents: 0,
    availableBalanceCents: 0,
    freeBalanceCents: 0,
    isLatestMonth: false,
  };
  const monthById = new Map(monthsSnapshot.docs.map((item) => {
    const data = item.data();
    return [item.id, { year: Number(data.year), month: Number(data.month) }] as const;
  }));
  const portfolioMovements = snapshot.docs
    .filter((item) => item.data().kind === "investor" && ["purchase", "reserve", "contribution"].includes(String(item.data().type)))
    .map((item) => {
      const data = item.data();
      const monthId = String(data.monthId);
      const linkedMonth = monthById.get(monthId);
      return {
        id: item.id,
        type: data.type === "reserve" ? "reserve" as const : data.type === "contribution" ? "contribution" as const : "purchase" as const,
        year: linkedMonth?.year ?? Number(data.year),
        month: linkedMonth?.month ?? Number(data.month),
        monthId,
        category: data.category as InvestmentPurchaseCategory | undefined,
        asset: typeof data.asset === "string" ? data.asset : undefined,
        quantity: typeof data.quantity === "number" ? data.quantity : undefined,
        unitPriceCents: Number(data.unitPriceCents) || undefined,
        additionalCostsCents: Number(data.additionalCostsCents) || 0,
        direction: data.direction === "withdrawal" ? "withdrawal" as const : data.direction === "deposit" ? "deposit" as const : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        amountCents: Number(data.amountCents) || 0,
      };
    });

  const monthRecords = monthsSnapshot.docs.map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }))
    .filter((item) => Number.isInteger(Number(item.data.year)) && Number.isInteger(Number(item.data.month)))
    .map((item) => ({ id: item.id, year: Number(item.data.year), month: Number(item.data.month), key: getMonthKey(Number(item.data.year), Number(item.data.month)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  summary.isLatestMonth = monthRecords[monthRecords.length - 1]?.id === monthId;
  const monthsThroughSelection = monthRecords.filter((item) => item.key <= selectedKey);
  const earliestMovementMonth = portfolioMovements
    .map((movement) => getMonthKey(movement.year, movement.month))
    .filter((key) => key <= selectedKey)
    .sort()[0];
  const earliestPlanMonth = plans.map((plan) => plan.effectiveMonth).filter((key) => key <= selectedKey).sort()[0];
  const trackingStart = [earliestMovementMonth, earliestPlanMonth].filter((key): key is string => !!key).sort()[0] || selectedKey;
  const trackedMonths = monthsThroughSelection.filter((item) => item.key >= trackingStart);
  let freeBalanceCents = 0;
  let reserveBalanceCents = 0;
  let reserveFundedPurchaseBalanceCents = 0;

  for (const ledgerMonth of trackedMonths) {
    const applicablePlans = plans.filter((item) => item.effectiveMonth <= ledgerMonth.key);
    const plan = applicablePlans[applicablePlans.length - 1];
    const monthlyPlanCents = Math.round((plan?.monthlyPlan ?? DEFAULT_INVESTOR_SETTINGS.monthlyPlan) * 100);
    freeBalanceCents += monthlyPlanCents;
    const monthMovements = portfolioMovements.filter((movement) => movement.monthId === ledgerMonth.id);
    reserveFundedPurchaseBalanceCents += monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "withdrawal")
      .reduce((total, movement) => total + movement.amountCents, 0);
    let monthlyCashOutflowCents = monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "deposit")
      .reduce((total, movement) => total + movement.amountCents, 0);
    for (const movement of monthMovements) {
      if (movement.type === "purchase" && movement.category) {
        freeBalanceCents -= movement.amountCents;
        const fundedFromReserveCents = Math.min(reserveFundedPurchaseBalanceCents, movement.amountCents);
        reserveFundedPurchaseBalanceCents -= fundedFromReserveCents;
        monthlyCashOutflowCents += movement.amountCents - fundedFromReserveCents;
        if (ledgerMonth.id === monthId && movement.category) {
          summary.monthlyCategoryTotalsCents[movement.category] = (summary.monthlyCategoryTotalsCents[movement.category] || 0) + movement.amountCents;
          summary.monthlyPurchasesCents += movement.amountCents;
        }
      } else if (movement.type === "reserve") {
        if (movement.direction === "deposit") {
          freeBalanceCents -= movement.amountCents;
          reserveBalanceCents += movement.amountCents;
          if (ledgerMonth.id === monthId) summary.monthlyReserveDepositsCents += movement.amountCents;
        } else if (movement.direction === "withdrawal") {
          reserveBalanceCents -= movement.amountCents;
          freeBalanceCents += movement.amountCents;
          if (ledgerMonth.id === monthId) summary.monthlyReserveWithdrawalsCents += movement.amountCents;
        }
      }
    }
    if (ledgerMonth.id === monthId) {
      summary.availableBalanceCents = freeBalanceCents;
      summary.monthlyCashOutflowCents = monthlyCashOutflowCents;
    }
  }

  summary.reserveBalanceCents = reserveBalanceCents;
  summary.freeBalanceCents = summary.availableBalanceCents;

  return {
    portfolioMovements,
    summary,
  };
}

const validatePurchase = (purchase: InvestmentPurchaseInput) => {
  if (!purchase.category || purchase.category === "opportunities") throw new Error("Categoria de compra inválida.");
  if (!purchase.asset.trim()) throw new Error("Informe o código do ativo.");
  if (!Number.isFinite(purchase.quantity) || purchase.quantity <= 0 || Math.abs(purchase.quantity * 1000 - Math.round(purchase.quantity * 1000)) > 0.000001) throw new Error("A quantidade deve ser maior que zero e ter no máximo três casas decimais.");
  if (!Number.isInteger(purchase.unitPriceCents) || purchase.unitPriceCents <= 0) throw new Error("O preço unitário deve ser maior que zero.");
  if (!Number.isInteger(purchase.additionalCostsCents) || purchase.additionalCostsCents < 0) throw new Error("Os custos adicionais não podem ser negativos.");
  return Math.round(purchase.quantity * purchase.unitPriceCents) + purchase.additionalCostsCents;
};

export async function saveInvestmentPurchase(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  purchase: InvestmentPurchaseInput,
  movementId?: string,
) {
  const amountCents = validatePurchase(purchase);
  await assertMonthExists(groupId, monthId, year, month);
  const settings = await getInvestorSettings(groupId, year, month);
  if (!settings.selectedCategoryIds.includes(purchase.category)) throw new Error("Esta categoria não está selecionada no planejamento do mês.");
  const data = {
    groupId,
    kind: "investor",
    type: "purchase",
    year,
    month,
    monthId,
    category: purchase.category,
    asset: purchase.asset.trim().toUpperCase(),
    quantity: purchase.quantity,
    unitPriceCents: purchase.unitPriceCents,
    additionalCostsCents: purchase.additionalCostsCents,
    amountCents,
    createdBy: userId,
    updatedAt: serverTimestamp(),
  };

  const current = await getInvestorPortfolioData(groupId, year, month, monthId);
  let availableToSpend = current.summary.freeBalanceCents;
  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId);
    const oldMovement = current.portfolioMovements.find((movement) => movement.id === movementId);
    if (oldMovement?.type === "purchase") availableToSpend += oldMovement.amountCents;
  }
  if (amountCents > availableToSpend) throw new Error("A compra excede o saldo livre disponível. Utilize a reserva ou aguarde novos recursos.");

  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId);
    await updateDoc(doc(db, "investments", movementId), data);
  } else {
    await setDoc(doc(collection(db, "investments")), { ...data, createdAt: serverTimestamp() });
  }
}

export async function saveReserveMovement(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  movement: ReserveMovementInput,
  movementId?: string,
) {
  if (movement.direction !== "deposit" && movement.direction !== "withdrawal") throw new Error("Tipo de movimentação inválido.");
  if (!Number.isInteger(movement.amountCents) || movement.amountCents <= 0) throw new Error("O valor da movimentação deve ser maior que zero.");
  await assertMonthExists(groupId, monthId, year, month);
  const data = {
    groupId,
    kind: "investor",
    type: "reserve",
    year,
    month,
    monthId,
    category: "opportunities",
    direction: movement.direction,
    description: movement.description.trim(),
    amountCents: movement.amountCents,
    createdBy: userId,
    updatedAt: serverTimestamp(),
  };

  const current = await getInvestorPortfolioData(groupId, year, month, monthId);
  let freeBalance = current.summary.freeBalanceCents;
  let reserveBalance = current.summary.reserveBalanceCents;
  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId);
    const oldMovement = current.portfolioMovements.find((item) => item.id === movementId);
    if (oldMovement?.type === "reserve") {
      if (oldMovement.direction === "deposit") {
        freeBalance += oldMovement.amountCents;
        reserveBalance -= oldMovement.amountCents;
      } else {
        freeBalance -= oldMovement.amountCents;
        reserveBalance += oldMovement.amountCents;
      }
    }
  }
  if (movement.direction === "deposit" && movement.amountCents > freeBalance) throw new Error("O valor excede o saldo livre disponível.");
  if (movement.direction === "withdrawal" && movement.amountCents > reserveBalance) throw new Error("A utilização excede o valor disponível na reserva.");
  if (freeBalance < 0 || reserveBalance < 0) throw new Error("A movimentação deixaria o saldo negativo.");

  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId);
    await updateDoc(doc(db, "investments", movementId), data);
  } else {
    await setDoc(doc(collection(db, "investments")), { ...data, createdAt: serverTimestamp() });
  }
}

export async function deleteInvestorMovement(
  groupId: string,
  monthId: string,
  movementId: string,
) {
  await assertMovementBelongsToMonth(groupId, monthId, movementId);
  await deleteDoc(doc(db, "investments", movementId));
}
