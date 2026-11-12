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
  type Firestore,
} from "firebase/firestore";
import {
  DEFAULT_INVESTOR_SETTINGS,
  type InvestorSettings,
  type InvestorMovement,
  type InvestorPortfolioSummary,
  type InvestmentCategory,
  type InvestmentPurchaseCategory,
  type InvestmentPurchaseInput,
  type ReserveMovementInput,
} from "../../../domain/finance/investment";

const getMonthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

type InvestorLedgerMonth = { id: string; year: number; month: number };
type InvestorLedgerPlan = { effectiveMonth: string; monthlyPlan: number };
const getMovementAmountCents = (movement: InvestorMovement) =>
  movement.type === "reserve" && Number.isInteger(movement.amountMilli)
    ? Number(movement.amountMilli) / 10
    : movement.amountCents;

export function calculateInvestorMonthlyBalanceImpacts(
  months: InvestorLedgerMonth[],
  movements: InvestorMovement[],
  plans: InvestorLedgerPlan[],
) {
  const monthRecords = months
    .filter((item) => Number.isInteger(item.year) && Number.isInteger(item.month) && item.month >= 1 && item.month <= 12)
    .map((item) => ({ ...item, key: getMonthKey(item.year, item.month) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const earliestMovementMonth = movements
    .map((movement) => getMonthKey(movement.year, movement.month))
    .sort()[0];
  const earliestPlanMonth = plans.map((plan) => plan.effectiveMonth).sort()[0];
  const trackingStart = [earliestMovementMonth, earliestPlanMonth].filter((key): key is string => !!key).sort()[0];
  const trackedMonths = trackingStart
    ? monthRecords.filter((item) => item.key >= trackingStart)
    : [];
  let freeBalanceCents = 0;
  let reserveFundedPurchaseBalanceCents = 0;
  const impacts = new Map<string, number>();

  for (const ledgerMonth of trackedMonths) {
    const freeBalanceBeforeMonthCents = freeBalanceCents;
    const plan = plans.filter((item) => item.effectiveMonth <= ledgerMonth.key).at(-1);
    freeBalanceCents += Math.round((plan?.monthlyPlan ?? DEFAULT_INVESTOR_SETTINGS.monthlyPlan) * 100);
    const monthMovements = movements.filter((movement) => movement.monthId === ledgerMonth.id);
    const hasInvestmentActivity = monthMovements.some((movement) =>
      (movement.type === "purchase" && Boolean(movement.category))
      || (movement.type === "reserve" && movement.direction === "deposit"),
    );
    reserveFundedPurchaseBalanceCents += monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "withdrawal")
      .reduce((total, movement) => total + getMovementAmountCents(movement), 0);
    let monthlyCashOutflowCents = monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "deposit")
      .reduce((total, movement) => total + getMovementAmountCents(movement), 0);

    for (const movement of monthMovements) {
      if (movement.type === "purchase" && movement.category) {
        freeBalanceCents -= movement.amountCents;
        const fundedFromReserveCents = Math.min(reserveFundedPurchaseBalanceCents, movement.amountCents);
        reserveFundedPurchaseBalanceCents -= fundedFromReserveCents;
        monthlyCashOutflowCents += movement.amountCents - fundedFromReserveCents;
      } else if (movement.type === "reserve") {
        const amountCents = getMovementAmountCents(movement);
        if (movement.direction === "deposit") freeBalanceCents -= amountCents;
        else if (movement.direction === "withdrawal") freeBalanceCents += amountCents;
      }
    }

    const availableBalanceChangeCents = hasInvestmentActivity
      ? freeBalanceCents - freeBalanceBeforeMonthCents
      : 0;
    impacts.set(ledgerMonth.id, monthlyCashOutflowCents + availableBalanceChangeCents);
  }

  return impacts;
}

export async function getInvestorMonthlyBalanceImpacts(
  groupId: string,
  months: InvestorLedgerMonth[],
  firestore: Firestore,
) {
  const [snapshot, settingsSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, "investments"), where("groupId", "==", groupId))),
    getDocs(query(collection(firestore, "settings"), where("groupId", "==", groupId))),
  ]);
  const monthById = new Map(months.map((month) => [month.id, month]));
  const movements: InvestorMovement[] = snapshot.docs
    .filter((item) => item.data().kind === "investor" && ["purchase", "reserve", "contribution"].includes(String(item.data().type)))
    .map((item) => {
      const data = item.data();
      const linkedMonthId = String(data.monthId || "");
      const linkedMonth = monthById.get(linkedMonthId);
      return {
        id: item.id,
        type: data.type === "reserve" ? "reserve" as const : data.type === "contribution" ? "contribution" as const : "purchase" as const,
        year: linkedMonth?.year ?? Number(data.year),
        month: linkedMonth?.month ?? Number(data.month),
        monthId: linkedMonthId,
        category: data.category as InvestmentPurchaseCategory | undefined,
        direction: data.direction === "withdrawal" ? "withdrawal" as const : data.direction === "deposit" ? "deposit" as const : undefined,
        amountCents: Number.isInteger(data.amountMilli) ? Number(data.amountMilli) / 10 : Number(data.amountCents) || 0,
        amountMilli: Number.isInteger(data.amountMilli) ? Number(data.amountMilli) : undefined,
      };
    });
  const plans: InvestorLedgerPlan[] = settingsSnapshot.docs
    .map((item) => item.data())
    .filter((item) => item.kind === "investor" && typeof item.effectiveMonth === "string")
    .map((item) => ({ effectiveMonth: String(item.effectiveMonth), monthlyPlan: Number(item.monthlyPlan) || 0 }))
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));

  return calculateInvestorMonthlyBalanceImpacts(months, movements, plans);
}

export async function getInvestorSettings(
  groupId: string,
  year: number,
  month: number,
  firestore: Firestore,
): Promise<InvestorSettings> {
  const settingsSnapshot = await getDocs(
    query(collection(firestore, "settings"), where("groupId", "==", groupId)),
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
  firestore: Firestore,
) {
  const effectiveMonth = getMonthKey(year, month);
  await setDoc(doc(firestore, "settings", `${groupId}_investor_${effectiveMonth}`), {
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
  firestore: Firestore,
) {
  if (!monthId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mês de referência inválido.");
  }
  const monthSnapshot = await getDoc(doc(firestore, "months", monthId));
  const monthData = monthSnapshot.data();
  if (!monthSnapshot.exists() || monthData?.groupId !== groupId || monthData?.year !== year || monthData?.month !== month) {
    throw new Error("O mês selecionado não existe no espaço atual.");
  }
}

async function assertMovementBelongsToMonth(
  groupId: string,
  monthId: string,
  movementId: string,
  firestore: Firestore,
) {
  const movementSnapshot = await getDoc(doc(firestore, "investments", movementId));
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
  firestore: Firestore,
): Promise<{
  portfolioMovements: InvestorMovement[];
  summary: InvestorPortfolioSummary;
}> {
  await assertMonthExists(groupId, monthId, year, month, firestore);
  const [snapshot, monthsSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, "investments"), where("groupId", "==", groupId))),
    getDocs(query(collection(firestore, "months"), where("groupId", "==", groupId))),
    getDocs(query(collection(firestore, "settings"), where("groupId", "==", groupId))),
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
    monthlyBalanceImpactCents: 0,
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
        unitPriceCents: Number.isInteger(data.unitPriceMilli) ? Number(data.unitPriceMilli) / 10 : Number(data.unitPriceCents) || undefined,
        unitPriceMilli: Number.isInteger(data.unitPriceMilli) ? Number(data.unitPriceMilli) : undefined,
        additionalCostsCents: Number(data.additionalCostsCents) || 0,
        direction: data.direction === "withdrawal" ? "withdrawal" as const : data.direction === "deposit" ? "deposit" as const : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        amountCents: Number.isInteger(data.amountMilli) ? Number(data.amountMilli) / 10 : Number(data.amountCents) || 0,
        amountMilli: Number.isInteger(data.amountMilli) ? Number(data.amountMilli) : undefined,
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
    const freeBalanceBeforeMonthCents = freeBalanceCents;
    const applicablePlans = plans.filter((item) => item.effectiveMonth <= ledgerMonth.key);
    const plan = applicablePlans[applicablePlans.length - 1];
    const monthlyPlanCents = Math.round((plan?.monthlyPlan ?? DEFAULT_INVESTOR_SETTINGS.monthlyPlan) * 100);
    freeBalanceCents += monthlyPlanCents;
    const monthMovements = portfolioMovements.filter((movement) => movement.monthId === ledgerMonth.id);
    const hasInvestmentActivity = monthMovements.some((movement) =>
      (movement.type === "purchase" && Boolean(movement.category))
      || (movement.type === "reserve" && movement.direction === "deposit"),
    );
    reserveFundedPurchaseBalanceCents += monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "withdrawal")
      .reduce((total, movement) => total + getMovementAmountCents(movement), 0);
    let monthlyCashOutflowCents = monthMovements
      .filter((movement) => movement.type === "reserve" && movement.direction === "deposit")
      .reduce((total, movement) => total + getMovementAmountCents(movement), 0);
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
        const amountCents = getMovementAmountCents(movement);
        if (movement.direction === "deposit") {
          freeBalanceCents -= amountCents;
          reserveBalanceCents += amountCents;
          if (ledgerMonth.id === monthId) summary.monthlyReserveDepositsCents += amountCents;
        } else if (movement.direction === "withdrawal") {
          reserveBalanceCents -= amountCents;
          freeBalanceCents += amountCents;
          if (ledgerMonth.id === monthId) summary.monthlyReserveWithdrawalsCents += amountCents;
        }
      }
    }
    if (ledgerMonth.id === monthId) {
      summary.availableBalanceCents = freeBalanceCents;
      summary.monthlyCashOutflowCents = monthlyCashOutflowCents;
      const availableBalanceChangeCents = hasInvestmentActivity
        ? freeBalanceCents - freeBalanceBeforeMonthCents
        : 0;
      summary.monthlyBalanceImpactCents = monthlyCashOutflowCents + availableBalanceChangeCents;
    }
  }

  summary.reserveBalanceCents = reserveBalanceCents;
  summary.freeBalanceCents = summary.availableBalanceCents;
  summary.monthlyBalanceImpactCents = calculateInvestorMonthlyBalanceImpacts(
    monthRecords,
    portfolioMovements,
    plans,
  ).get(monthId) || 0;

  return {
    portfolioMovements,
    summary,
  };
}

const validatePurchase = (purchase: InvestmentPurchaseInput) => {
  if (!purchase.category || purchase.category === "opportunities") throw new Error("Categoria de compra inválida.");
  if (!purchase.asset.trim()) throw new Error("Informe o código do ativo.");
  if (!Number.isFinite(purchase.quantity) || purchase.quantity <= 0 || Math.abs(purchase.quantity * 1000 - Math.round(purchase.quantity * 1000)) > 0.000001) throw new Error("A quantidade deve ser maior que zero e ter no máximo três casas decimais.");
  if (!Number.isInteger(purchase.unitPriceMilli) || purchase.unitPriceMilli <= 0) throw new Error("O preço unitário deve ser maior que zero e ter no máximo três casas decimais.");
  if (!Number.isInteger(purchase.additionalCostsCents) || purchase.additionalCostsCents < 0) throw new Error("Os custos adicionais não podem ser negativos.");
  return Math.round(purchase.quantity * purchase.unitPriceMilli / 10) + purchase.additionalCostsCents;
};

export async function saveInvestmentPurchase(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  purchase: InvestmentPurchaseInput,
  movementId: string | undefined,
  firestore: Firestore,
) {
  const amountCents = validatePurchase(purchase);
  await assertMonthExists(groupId, monthId, year, month, firestore);
  const settings = await getInvestorSettings(groupId, year, month, firestore);
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
    unitPriceMilli: purchase.unitPriceMilli,
    // Compatibilidade de leitura com versões antigas, que armazenam centavos.
    unitPriceCents: Math.round(purchase.unitPriceMilli / 10),
    additionalCostsCents: purchase.additionalCostsCents,
    amountCents,
    createdBy: userId,
    updatedAt: serverTimestamp(),
  };

  const current = await getInvestorPortfolioData(groupId, year, month, monthId, firestore);
  let availableToSpend = current.summary.freeBalanceCents;
  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId, firestore);
    const oldMovement = current.portfolioMovements.find((movement) => movement.id === movementId);
    if (oldMovement?.type === "purchase") availableToSpend += oldMovement.amountCents;
  }
  if (amountCents > availableToSpend) throw new Error("A compra excede o saldo livre disponível. Utilize a reserva ou aguarde novos recursos.");

  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId, firestore);
    await updateDoc(doc(firestore, "investments", movementId), data);
  } else {
    await setDoc(doc(collection(firestore, "investments")), { ...data, createdAt: serverTimestamp() });
  }
}

export async function saveReserveMovement(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  movement: ReserveMovementInput,
  movementId: string | undefined,
  firestore: Firestore,
) {
  if (movement.direction !== "deposit" && movement.direction !== "withdrawal") throw new Error("Tipo de movimentação inválido.");
  if (!Number.isInteger(movement.amountMilli) || movement.amountMilli <= 0) throw new Error("O valor da movimentação deve ser maior que zero e ter no máximo três casas decimais.");
  await assertMonthExists(groupId, monthId, year, month, firestore);
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
    amountMilli: movement.amountMilli,
    // Mantém uma aproximação em centavos para versões anteriores do aplicativo.
    amountCents: Math.round(movement.amountMilli / 10),
    createdBy: userId,
    updatedAt: serverTimestamp(),
  };

  const current = await getInvestorPortfolioData(groupId, year, month, monthId, firestore);
  let freeBalance = current.summary.freeBalanceCents;
  let reserveBalance = current.summary.reserveBalanceCents;
  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId, firestore);
    const oldMovement = current.portfolioMovements.find((item) => item.id === movementId);
    if (oldMovement?.type === "reserve") {
      if (oldMovement.direction === "deposit") {
        const oldMovementCents = getMovementAmountCents(oldMovement);
        freeBalance += oldMovementCents;
        reserveBalance -= oldMovementCents;
      } else {
        const oldMovementCents = getMovementAmountCents(oldMovement);
        freeBalance -= oldMovementCents;
        reserveBalance += oldMovementCents;
      }
    }
  }
  const movementAmountCents = movement.amountMilli / 10;
  if (movement.direction === "deposit" && movementAmountCents > freeBalance) throw new Error("O valor excede o saldo livre disponível.");
  if (movement.direction === "withdrawal" && movementAmountCents > reserveBalance) throw new Error("A utilização excede o valor disponível na reserva.");
  if (freeBalance < 0 || reserveBalance < 0) throw new Error("A movimentação deixaria o saldo negativo.");

  if (movementId) {
    await assertMovementBelongsToMonth(groupId, monthId, movementId, firestore);
    await updateDoc(doc(firestore, "investments", movementId), data);
  } else {
    await setDoc(doc(collection(firestore, "investments")), { ...data, createdAt: serverTimestamp() });
  }
}

export async function deleteInvestorMovement(
  groupId: string,
  monthId: string,
  movementId: string,
  firestore: Firestore,
) {
  await assertMovementBelongsToMonth(groupId, monthId, movementId, firestore);
  await deleteDoc(doc(firestore, "investments", movementId));
}
