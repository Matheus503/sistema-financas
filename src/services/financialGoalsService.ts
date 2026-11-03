import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firestore";

export type FinancialGoal = {
  id: string;
  name: string;
  targetAmountCents: number;
  durationMonths: number;
  monthlyAmountCents: number;
  plannedMonthlyCents: number;
  confirmedThisMonthCents: number;
  isConfirmedThisMonth: boolean;
  reservedAmountCents: number;
  reservedBeforeMonthCents: number;
};

export type FinancialGoalInput = {
  name: string;
  targetAmountCents: number;
  durationMonths: number;
};

const getMonthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

const getInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const getCreatedAtMillis = (value: unknown) => {
  const timestamp = value as { toMillis?: () => number } | undefined;
  return typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : 0;
};

const comparePlanSnapshots = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) => String(a.effectiveMonth).localeCompare(String(b.effectiveMonth))
  || getCreatedAtMillis(a.createdAt) - getCreatedAtMillis(b.createdAt);

const monthDistance = (startKey: string, currentKey: string) => {
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [currentYear, currentMonth] = currentKey.split("-").map(Number);
  return (currentYear - startYear) * 12 + currentMonth - startMonth;
};

const getMonthlyAmountForPlan = (plan: Record<string, unknown>, monthKey: string) => {
  const effectiveMonth = String(plan.effectiveMonth || "");
  const durationMonths = getInteger(plan.durationMonths);
  if (durationMonths <= 0) return getInteger(plan.monthlyAmountCents);
  const monthOffset = monthDistance(effectiveMonth, monthKey);
  if (monthOffset < 0 || monthOffset >= durationMonths) return 0;
  return Math.max(0, getInteger(plan.targetAmountCents) - getInteger(plan.startingReservedCents));
};

const assertMonthExists = async (
  groupId: string,
  monthId: string,
  year: number,
  month: number,
) => {
  if (!monthId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mês de referência inválido.");
  }
  const monthSnapshot = await getDoc(doc(db, "months", monthId));
  const monthData = monthSnapshot.data();
  if (!monthSnapshot.exists() || monthData?.groupId !== groupId || Number(monthData?.year) !== year || Number(monthData?.month) !== month) {
    throw new Error("O mês selecionado não existe no espaço atual.");
  }
};

const loadGoalSettings = async (groupId: string) => {
  const snapshot = await getDocs(query(collection(db, "settings"), where("groupId", "==", groupId)));
  const goals = snapshot.docs
    .filter((item) => item.data().kind === "financialGoal")
    .map((item) => ({ id: item.id, ...item.data() }));
  const plans = snapshot.docs
    .filter((item) => item.data().kind === "financialGoalPlan")
    .map((item) => ({ id: item.id, ...item.data() }));
  const contributions = snapshot.docs
    .filter((item) => item.data().kind === "financialGoalContribution")
    .map((item) => ({ id: item.id, ...item.data() }));
  return { goals, plans, contributions };
};

export async function getFinancialGoalsData(
  groupId: string,
  year: number,
  month: number,
  monthId: string,
): Promise<{ goals: FinancialGoal[]; monthlyPlanCents: number }> {
  await assertMonthExists(groupId, monthId, year, month);
  const selectedKey = getMonthKey(year, month);
  const [settings, monthsSnapshot] = await Promise.all([
    loadGoalSettings(groupId),
    getDocs(query(collection(db, "months"), where("groupId", "==", groupId))),
  ]);
  const monthRecords = monthsSnapshot.docs
    .map((item) => ({ id: item.id, year: Number(item.data().year), month: Number(item.data().month) }))
    .filter((item) => Number.isInteger(item.year) && item.month >= 1 && item.month <= 12)
    .map((item) => ({ ...item, key: getMonthKey(item.year, item.month) }))
    .filter((item) => item.key <= selectedKey)
    .sort((a, b) => a.key.localeCompare(b.key));
  const contributions = settings.contributions as Array<Record<string, unknown>>;
  const getReservedBefore = (goalId: string, beforeKey: string) => contributions
    .filter((item) => item.goalId === goalId && typeof item.effectiveMonth === "string" && item.effectiveMonth < beforeKey)
    .reduce((total, item) => total + getInteger(item.amountCents), 0);
  const getContributionThisMonth = (goalId: string) => contributions
    .filter((item) => item.goalId === goalId && item.effectiveMonth === selectedKey)
    .reduce((total, item) => total + getInteger(item.amountCents), 0);

  const goals: FinancialGoal[] = [];
  for (const rawGoal of settings.goals) {
    const goal = rawGoal as Record<string, unknown> & { id: string };
    const createdMonth = String(goal.createdMonth || "");
    if (!createdMonth || createdMonth > selectedKey) continue;
    const plans = settings.plans
      .filter((rawPlan) => {
        const plan = rawPlan as Record<string, unknown>;
        return plan.goalId === goal.id && typeof plan.effectiveMonth === "string";
      })
      .map((rawPlan) => rawPlan as Record<string, unknown> & { id: string })
      .sort(comparePlanSnapshots);
    const planAt = (key: string) => plans.filter((plan) => String(plan.effectiveMonth) <= key).at(-1);
    const currentPlan = planAt(selectedKey);
    if (!currentPlan) continue;
    if (currentPlan.status === "deleted") continue;

    const reservedBeforeMonthCents = getReservedBefore(goal.id, selectedKey);
    const duration = getInteger(currentPlan.durationMonths);
    const monthOffset = monthDistance(String(currentPlan.effectiveMonth), selectedKey);
    const remainingMonths = Math.max(1, duration - monthOffset);
    const remainingAmount = Math.max(0, getInteger(currentPlan.targetAmountCents ?? goal.targetAmountCents) - reservedBeforeMonthCents);
    const monthlyAmountCents = duration > 0 && monthOffset < duration
      ? Math.ceil(remainingAmount / remainingMonths)
      : duration > 0 ? 0 : getMonthlyAmountForPlan(currentPlan, selectedKey);
    const confirmedThisMonthCents = getContributionThisMonth(goal.id);
    const reservedAmountCents = reservedBeforeMonthCents + confirmedThisMonthCents;
    goals.push({
      id: goal.id,
      name: String(currentPlan.name || goal.name || "Objetivo"),
      targetAmountCents: getInteger(currentPlan.targetAmountCents ?? goal.targetAmountCents),
      durationMonths: Math.max(0, getInteger(currentPlan.durationMonths) - monthDistance(String(currentPlan.effectiveMonth), selectedKey)),
      monthlyAmountCents,
      plannedMonthlyCents: monthlyAmountCents,
      confirmedThisMonthCents,
      isConfirmedThisMonth: confirmedThisMonthCents > 0,
      reservedAmountCents,
      reservedBeforeMonthCents,
    });
  }

  return {
    goals,
    monthlyPlanCents: contributions
      .filter((item) => item.effectiveMonth === selectedKey)
      .reduce((total, item) => total + getInteger(item.amountCents), 0),
  };
}

export async function saveFinancialGoal(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  input: FinancialGoalInput,
  goalId?: string,
) {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome do objetivo.");
  if (!Number.isInteger(input.targetAmountCents) || input.targetAmountCents <= 0) throw new Error("O valor da meta deve ser maior que zero.");
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1 || input.durationMonths > 600) throw new Error("Informe um prazo entre 1 e 600 meses.");
  await assertMonthExists(groupId, monthId, year, month);

  const effectiveMonth = getMonthKey(year, month);
  const goalRef = goalId ? doc(db, "settings", goalId) : doc(collection(db, "settings"));
  let startingReservedCents = 0;
  if (goalId) {
    const goalSnapshot = await getDoc(goalRef);
    if (!goalSnapshot.exists() || goalSnapshot.data().groupId !== groupId || goalSnapshot.data().kind !== "financialGoal") {
      throw new Error("O objetivo não pertence ao espaço atual.");
    }
    const currentData = await getFinancialGoalsData(groupId, year, month, monthId);
    startingReservedCents = currentData.goals.find((goal) => goal.id === goalId)?.reservedBeforeMonthCents || 0;
  }
  const planRef = doc(collection(db, "settings"));
  const batch = writeBatch(db);
  if (goalId) {
    batch.update(goalRef, { name, targetAmountCents: input.targetAmountCents, status: "active", updatedAt: serverTimestamp() });
  } else {
    batch.set(goalRef, {
      groupId,
      kind: "financialGoal",
      name,
      targetAmountCents: input.targetAmountCents,
      createdMonth: effectiveMonth,
      status: "active",
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(planRef, {
    groupId,
    kind: "financialGoalPlan",
    goalId: goalRef.id,
    effectiveMonth,
    name,
    targetAmountCents: input.targetAmountCents,
    durationMonths: input.durationMonths,
    startingReservedCents,
    status: "active",
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function confirmFinancialGoalContribution(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  goalId: string,
) {
  await assertMonthExists(groupId, monthId, year, month);
  const { goals, plans, contributions } = await loadGoalSettings(groupId);
  const goal = goals.find((item) => item.id === goalId) as (Record<string, unknown> & { id: string }) | undefined;
  if (!goal) throw new Error("O objetivo não pertence ao espaço atual.");
  const currentKey = getMonthKey(year, month);
  const currentPlan = plans
    .filter((rawPlan) => {
      const plan = rawPlan as Record<string, unknown>;
      return plan.goalId === goalId && typeof plan.effectiveMonth === "string" && plan.effectiveMonth <= currentKey;
    })
    .sort(comparePlanSnapshots)
    .at(-1) as (Record<string, unknown> & { id: string }) | undefined;
  if (!currentPlan) throw new Error("O planejamento mensal do objetivo não foi encontrado.");
  const currentData = await getFinancialGoalsData(groupId, year, month, monthId);
  const goalData = currentData.goals.find((goal) => goal.id === goalId);
  if (!goalData || goalData.plannedMonthlyCents <= 0) throw new Error("Não há valor planejado para efetivar neste mês.");
  if (goalData.isConfirmedThisMonth) throw new Error("Este objetivo já foi efetivado neste mês.");
  const duplicate = contributions.some((rawContribution) => {
    const contribution = rawContribution as Record<string, unknown>;
    return contribution.goalId === goalId && contribution.effectiveMonth === currentKey;
  });
  if (duplicate) throw new Error("Este objetivo já foi efetivado neste mês.");
  const contributionRef = doc(collection(db, "settings"));
  const batch = writeBatch(db);
  batch.set(contributionRef, {
    groupId,
    kind: "financialGoalContribution",
    goalId,
    effectiveMonth: currentKey,
    amountCents: goalData.plannedMonthlyCents,
    name: String(currentPlan.name || goal.name),
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteFinancialGoal(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  goalId: string,
) {
  await assertMonthExists(groupId, monthId, year, month);
  const goalRef = doc(db, "settings", goalId);
  const goalSnapshot = await getDoc(goalRef);
  if (!goalSnapshot.exists() || goalSnapshot.data().groupId !== groupId || goalSnapshot.data().kind !== "financialGoal") {
    throw new Error("O objetivo não pertence ao espaço atual.");
  }
  const { plans } = await loadGoalSettings(groupId);
  const effectiveMonth = getMonthKey(year, month);
  const currentPlan = plans
    .filter((rawPlan) => {
      const plan = rawPlan as Record<string, unknown>;
      return plan.goalId === goalId && typeof plan.effectiveMonth === "string" && plan.effectiveMonth <= effectiveMonth;
    })
    .map((rawPlan) => rawPlan as Record<string, unknown>)
    .sort(comparePlanSnapshots)
    .at(-1);
  if (!currentPlan) throw new Error("O planejamento mensal do objetivo não foi encontrado.");
  if (currentPlan.status === "deleted") throw new Error("Este objetivo já foi excluído.");

  const batch = writeBatch(db);
  batch.update(goalRef, { status: "deleted", deletedFromMonth: effectiveMonth, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, "settings")), {
    groupId,
    kind: "financialGoalPlan",
    goalId,
    effectiveMonth,
    name: String(currentPlan.name || goalSnapshot.data().name || "Objetivo"),
    targetAmountCents: getInteger(currentPlan.targetAmountCents ?? goalSnapshot.data().targetAmountCents),
    durationMonths: getInteger(currentPlan.durationMonths),
    startingReservedCents: getInteger(currentPlan.startingReservedCents),
    status: "deleted",
    createdBy: userId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
