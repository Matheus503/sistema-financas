"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart3, ChevronDown, ChevronUp, Pencil, Save, Settings2, Trash2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  DEFAULT_INVESTOR_SETTINGS,
  deleteInvestorMovement,
  getInvestorPortfolioData,
  getInvestorSettings,
  saveInvestorSettings,
  saveInvestmentPurchase,
  saveReserveMovement,
  type InvestmentCategoryId,
  type InvestmentCategory,
  type InvestmentPurchaseCategory,
  type InvestmentTargets,
  type InvestorMovement,
  type InvestorPortfolioSummary,
} from "../services/investmentService";
import ReportDetailDialog from "./ReportDetailDialog";

type Props = {
  groupId: string;
  userId: string;
  monthId: string;
  year: number;
  month: number;
  formatMoney: (amount: number) => string;
  onSaved?: () => void;
  onMonthlyCashOutflowChange?: (amountCents: number) => void;
};

type DraftTargets = Record<InvestmentCategoryId, string>;
type CategoryDetailScope = "month" | "cumulative";
type EditingMovement = { id: string; type: InvestorMovement["type"]; monthId: string; year: number; month: number } | null;
type InvestmentFormSelection = InvestmentPurchaseCategory | "reserve_deposit" | "reserve_withdrawal";

const asDraftTargets = (targets: InvestmentTargets): DraftTargets => Object.fromEntries(
  Object.entries(targets).map(([id, value]) => [id, formatPercentValue(value)]),
);

const parseDraft = (value: string) => {
  if (value.trim() === "") return Number.NaN;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};
const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
const hasAtMostThreeDecimals = (value: number) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
const toCents = (value: number) => Math.round(value * 100);
const formatCurrencyValue = (value: number) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercentValue = (value: number) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const formatCurrencyTyping = (value: string) => {
  const cents = Number(value.replace(/\D/g, ""));
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatPercentTyping = (value: string) => {
  const hundredths = Number(value.replace(/\D/g, ""));
  return (hundredths / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
};

const DISTRIBUTION_TOLERANCE_PCT = 3;
const CHART_COLORS = ["#a855f7", "#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#818cf8", "#fb7185", "#2dd4bf", "#c084fc", "#facc15"];
type AllocationStatus = "above" | "below" | "on_target";
const getAllocationTone = (status: AllocationStatus) => status === "above"
  ? { text: "text-red-300", border: "border-red-500/40", background: "bg-red-500/5", label: "Acima do planejado" }
  : status === "below"
    ? { text: "text-amber-300", border: "border-amber-500/40", background: "bg-amber-500/5", label: "Abaixo do planejado" }
    : { text: "text-emerald-300", border: "border-emerald-500/40", background: "bg-emerald-500/5", label: "Na margem do planejado" };

const EMPTY_PORTFOLIO_SUMMARY: InvestorPortfolioSummary = {
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

export default function InvestorSettingsPanel({ groupId, userId, monthId, year, month, formatMoney, onSaved, onMonthlyCashOutflowChange }: Props) {
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const selectedKey = `${groupId}:${monthId}:${selectedMonth}`;
  const [monthlyPlan, setMonthlyPlan] = useState(formatCurrencyValue(DEFAULT_INVESTOR_SETTINGS.monthlyPlan));
  const [categories, setCategories] = useState<InvestmentCategory[]>(DEFAULT_INVESTOR_SETTINGS.categories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<InvestmentCategoryId[]>(DEFAULT_INVESTOR_SETTINGS.selectedCategoryIds);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [targets, setTargets] = useState<DraftTargets>(asDraftTargets(DEFAULT_INVESTOR_SETTINGS.targets));
  const [savedTargets, setSavedTargets] = useState<InvestmentTargets>(DEFAULT_INVESTOR_SETTINGS.targets);
  const [portfolioMovements, setPortfolioMovements] = useState<InvestorMovement[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState(EMPTY_PORTFOLIO_SUMMARY);
  const [loadedKey, setLoadedKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<EditingMovement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<InvestmentCategoryId | null>(null);
  const [categoryDetailScope, setCategoryDetailScope] = useState<CategoryDetailScope>("month");
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [evolutionExpanded, setEvolutionExpanded] = useState(false);
  const [isEvolutionChartOpen, setIsEvolutionChartOpen] = useState(false);
  const [selectedChartCategoryIds, setSelectedChartCategoryIds] = useState<string[]>([]);
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [returnToCategory, setReturnToCategory] = useState<InvestmentCategoryId | null>(null);

  const [purchaseCategory, setPurchaseCategory] = useState<InvestmentFormSelection>("stocks");
  const [asset, setAsset] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [additionalCosts, setAdditionalCosts] = useState("0,00");
  const [reserveAmount, setReserveAmount] = useState("");
  const [reserveDescription, setReserveDescription] = useState("");

  const refreshData = useCallback(async () => {
    const [settings, portfolioData] = await Promise.all([
      getInvestorSettings(groupId, year, month),
      getInvestorPortfolioData(groupId, year, month, monthId),
    ]);
    setMonthlyPlan(formatCurrencyValue(settings.monthlyPlan));
    setCategories(settings.categories);
    setSelectedCategoryIds(settings.selectedCategoryIds);
    setTargets(asDraftTargets(settings.targets));
    setSavedTargets(settings.targets);
    setPortfolioMovements(portfolioData.portfolioMovements);
    setPortfolioSummary(portfolioData.summary);
    onMonthlyCashOutflowChange?.(portfolioData.summary.monthlyBalanceImpactCents);
    setLoadedKey(selectedKey);
    setLoadError("");
  }, [groupId, year, month, monthId, selectedKey, onMonthlyCashOutflowChange]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getInvestorSettings(groupId, year, month),
      getInvestorPortfolioData(groupId, year, month, monthId),
    ]).then(([settings, portfolioData]) => {
      if (!active) return;
      setMonthlyPlan(formatCurrencyValue(settings.monthlyPlan));
      setCategories(settings.categories);
      setSelectedCategoryIds(settings.selectedCategoryIds);
      setTargets(asDraftTargets(settings.targets));
      setSavedTargets(settings.targets);
      setPortfolioMovements(portfolioData.portfolioMovements);
      setPortfolioSummary(portfolioData.summary);
      onMonthlyCashOutflowChange?.(portfolioData.summary.monthlyBalanceImpactCents);
      setLoadedKey(selectedKey);
      setLoadError("");
    }).catch((error: unknown) => {
      console.error("Erro ao carregar a Área do investidor:", error);
      if (!active) return;
      setLoadError("Não foi possível carregar os dados deste mês. Tente novamente.");
    });
    return () => { active = false; };
  }, [groupId, year, month, monthId, selectedKey, onMonthlyCashOutflowChange]);

  const parsedTargets = useMemo(
    () => Object.fromEntries(categories.map(({ id }) => [id, parseDraft(targets[id] || "0,00")])) as InvestmentTargets,
    [categories, targets],
  );
  const activeCategories = categories.filter((category) => category.id === "opportunities" || selectedCategoryIds.includes(category.id));
  const purchaseCategories = activeCategories.filter((category) => category.id !== "opportunities");
  const formPurchaseCategories = editing?.type === "purchase" && editing && !purchaseCategories.some((category) => category.id === purchaseCategory)
    ? [...purchaseCategories, categories.find((category) => category.id === purchaseCategory)].filter((category): category is InvestmentCategory => !!category)
    : purchaseCategories;
  const targetTotal = activeCategories.reduce(
    (total, category) => total + (Number.isFinite(parsedTargets[category.id]) ? parsedTargets[category.id] : 0),
    0,
  );
  const parsedMonthlyPlan = parseDraft(monthlyPlan);
  const targetsAreValid = activeCategories.length > 0 && activeCategories.every(({ id }) =>
    Number.isFinite(parsedTargets[id]) && parsedTargets[id] >= 0 && parsedTargets[id] <= 100,
  );
  const settingsAreValid =
    Number.isFinite(parsedMonthlyPlan) &&
    parsedMonthlyPlan >= 0 &&
    hasAtMostTwoDecimals(parsedMonthlyPlan) &&
    targetsAreValid &&
    activeCategories.every(({ id }) => hasAtMostTwoDecimals(parsedTargets[id])) &&
    Math.abs(targetTotal - 100) < 0.000001;
  const isReady = loadedKey === selectedKey && !loadError;

  const parsedQuantity = parseDraft(quantity);
  const parsedUnitPrice = parseDraft(unitPrice);
  const parsedCosts = parseDraft(additionalCosts);
  const purchaseIsValid =
    asset.trim().length > 0 &&
    Number.isFinite(parsedQuantity) && parsedQuantity > 0 && hasAtMostThreeDecimals(parsedQuantity) &&
    Number.isFinite(parsedUnitPrice) && parsedUnitPrice > 0 && hasAtMostTwoDecimals(parsedUnitPrice) &&
    Number.isFinite(parsedCosts) && parsedCosts >= 0 && hasAtMostTwoDecimals(parsedCosts);
  const purchaseTotalCents = purchaseIsValid
    ? Math.round(parsedQuantity * toCents(parsedUnitPrice)) + toCents(parsedCosts)
    : 0;
  const parsedReserveAmount = parseDraft(reserveAmount);
  const reserveIsValid = Number.isFinite(parsedReserveAmount) && parsedReserveAmount > 0 && hasAtMostTwoDecimals(parsedReserveAmount);
  const isReserveSelected = purchaseCategory === "reserve_deposit" || purchaseCategory === "reserve_withdrawal";
  const reserveDirection = purchaseCategory === "reserve_withdrawal" ? "withdrawal" : "deposit";
  const movementIsValid = isReserveSelected ? reserveIsValid : purchaseIsValid;
  const expectedMovementType = isReserveSelected ? "reserve" : "purchase";
  const editorMatchesSelection = !editing || editing.type === expectedMovementType;
  const displaySummaryMoney = (cents: number) => isReady ? formatMoney(cents / 100) : "—";
  const monthlyBalanceCents = isReady ? portfolioSummary.availableBalanceCents : 0;
  const showRecommendations = isReady && portfolioSummary.isLatestMonth;
  const cumulativeMovements = portfolioMovements.filter(
    (movement) => `${movement.year}-${String(movement.month).padStart(2, "0")}` <= selectedMonth,
  );
  const cumulativeMovementIds = new Set(cumulativeMovements.map((movement) => movement.id));
  const isMovementInDetailScope = (movement: InvestorMovement) => categoryDetailScope === "month"
    ? movement.monthId === monthId
    : cumulativeMovementIds.has(movement.id);
  const categoryMovements = (selectedCategory === "opportunities"
    ? portfolioMovements.filter((movement) => isMovementInDetailScope(movement) && movement.type === "reserve")
    : portfolioMovements.filter((movement) => isMovementInDetailScope(movement) && movement.type === "purchase" && movement.category === selectedCategory))
    .slice()
    .sort((a, b) => b.year - a.year || b.month - a.month);
  const accumulatedInvestments = cumulativeMovements.reduce<InvestmentTargets>((totals, movement) => {
    if (movement.type === "purchase" && movement.category) {
      totals[movement.category] = (totals[movement.category] || 0) + movement.amountCents;
    } else if (movement.type === "reserve" && movement.direction) {
      totals.opportunities = (totals.opportunities || 0) + (movement.direction === "deposit" ? movement.amountCents : -movement.amountCents);
    }
    return totals;
  }, Object.fromEntries(categories.map((category) => [category.id, 0])) as InvestmentTargets);
  const chartCategories = categories.filter((category) => selectedCategoryIds.includes(category.id) || (accumulatedInvestments[category.id] || 0) > 0);
  const monthlyEvolution = (() => {
    const monthKeys = [...new Set(cumulativeMovements.map((movement) => `${movement.year}-${String(movement.month).padStart(2, "0")}`))].sort();
    const runningTotals: Record<string, number> = Object.fromEntries(chartCategories.map((category) => [category.id, 0]));
    return monthKeys.map((key) => {
      const [yearValue, monthValue] = key.split("-").map(Number);
      const monthlyValues: Record<string, number> = Object.fromEntries(chartCategories.map((category) => [category.id, 0]));
      for (const movement of cumulativeMovements) {
        if (`${movement.year}-${String(movement.month).padStart(2, "0")}` !== key) continue;
        if (movement.type === "purchase" && movement.category) {
          monthlyValues[movement.category] = (monthlyValues[movement.category] || 0) + movement.amountCents;
        } else if (movement.type === "reserve" && movement.direction) {
          monthlyValues.opportunities = (monthlyValues.opportunities || 0) + (movement.direction === "deposit" ? movement.amountCents : -movement.amountCents);
        }
      }
      for (const category of chartCategories) {
        runningTotals[category.id] = (runningTotals[category.id] || 0) + (monthlyValues[category.id] || 0);
      }
      return {
        monthKey: key,
        label: `${String(monthValue).padStart(2, "0")}/${yearValue}`,
        ...Object.fromEntries(chartCategories.map((category) => [category.id, runningTotals[category.id] || 0])),
        ...Object.fromEntries(chartCategories.map((category) => [`monthly_${category.id}`, monthlyValues[category.id] || 0])),
      };
    });
  })();
  const currentComposition = chartCategories
    .map((category) => ({ name: category.label, value: Math.max(0, accumulatedInvestments[category.id] || 0), id: category.id }))
    .filter((category) => category.value > 0);
  const selectedChartCategories = chartCategories.filter((category) => selectedChartCategoryIds.includes(category.id));
  const selectedComposition = currentComposition.filter((category) => selectedChartCategoryIds.includes(category.id));
  const openEvolutionCharts = () => {
    setSelectedChartCategoryIds(chartCategories.map((category) => category.id));
    setIsEvolutionChartOpen(true);
  };
  const distribution = useMemo(() => {
    const categoryIds = new Set([
      ...categories.map((category) => category.id),
      ...portfolioMovements.filter((movement) => movement.type === "purchase" && movement.category).map((movement) => movement.category!),
      "opportunities",
    ]);
    const values: Record<InvestmentCategoryId, number> = Object.fromEntries(
      [...categoryIds].map((id) => [id, id === "opportunities" ? Math.max(0, portfolioSummary.reserveBalanceCents) : 0]),
    );
    for (const movement of portfolioMovements) {
      const movementKey = `${movement.year}-${String(movement.month).padStart(2, "0")}`;
      if (movementKey > selectedMonth || movement.type !== "purchase" || !movement.category) continue;
      values[movement.category] = (values[movement.category] || 0) + movement.amountCents;
    }
    const totalCents = Object.values(values).reduce((sum, value) => sum + value, 0);
    const rows = activeCategories.map((category) => {
      const currentPct = totalCents > 0 ? values[category.id] / totalCents * 100 : 0;
      const differencePp = currentPct - (savedTargets[category.id] || 0);
      const status = differencePp > DISTRIBUTION_TOLERANCE_PCT
        ? "above" as const
        : differencePp < -DISTRIBUTION_TOLERANCE_PCT ? "below" as const : "on_target" as const;
      return { ...category, valueCents: values[category.id], currentPct, differencePp, status };
    });
    const calculateRecommendations = (categoryValues: Record<InvestmentCategoryId, number>, budgetCents: number) => {
      const categoryTotalCents = Object.values(categoryValues).reduce((sum, value) => sum + value, 0);
      const needs = activeCategories.map(({ id }) => Math.max(0, Math.round((savedTargets[id] || 0) / 100 * (categoryTotalCents + budgetCents)) - (categoryValues[id] || 0)));
      const totalNeedCents = needs.reduce((sum, value) => sum + value, 0);
      const allocations = totalNeedCents >= budgetCents && totalNeedCents > 0
        ? needs.map((need) => budgetCents * need / totalNeedCents)
        : needs.map((need, index) => need + Math.max(0, budgetCents - totalNeedCents) * (savedTargets[activeCategories[index].id] || 0) / 100);
      const allocatedCents = allocations.reduce((sum, value) => sum + Math.floor(value), 0);
      let remainingCents = Math.max(0, budgetCents - allocatedCents);
      const remainderOrder = allocations.map((value, index) => ({ index, fraction: value - Math.floor(value), weight: savedTargets[activeCategories[index].id] || 0 }))
        .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight);
      const result = Object.fromEntries(activeCategories.map(({ id }, index) => [id, Math.floor(allocations[index])])) as Record<InvestmentCategoryId, number>;
      for (const remainder of remainderOrder) {
        if (remainingCents <= 0) break;
        result[activeCategories[remainder.index].id] += 1;
        remainingCents -= 1;
      }
      return result;
    };
    const budgetCents = Math.max(0, portfolioSummary.freeBalanceCents);
    const recommended = calculateRecommendations(values, budgetCents);
    const previousMonthValues = Object.fromEntries([...categoryIds].map((id) => [
      id,
      Math.max(0, (values[id] || 0) - (id === "opportunities"
        ? portfolioSummary.monthlyReserveDepositsCents - portfolioSummary.monthlyReserveWithdrawalsCents
        : portfolioSummary.monthlyCategoryTotalsCents[id] || 0)),
    ]));
    const startingBudgetCents = Math.max(0,
      portfolioSummary.freeBalanceCents + portfolioSummary.monthlyPurchasesCents
        + portfolioSummary.monthlyReserveDepositsCents - portfolioSummary.monthlyReserveWithdrawalsCents,
    );
    const startingRecommendations = calculateRecommendations(previousMonthValues, startingBudgetCents);
    return { totalCents, rows, budgetCents, recommended, startingRecommendations };
  }, [categories, activeCategories, portfolioMovements, portfolioSummary.freeBalanceCents, portfolioSummary.reserveBalanceCents, portfolioSummary.monthlyCategoryTotalsCents, portfolioSummary.monthlyPurchasesCents, portfolioSummary.monthlyReserveDepositsCents, portfolioSummary.monthlyReserveWithdrawalsCents, savedTargets, selectedMonth]);

  const clearEditor = () => {
    setEditing(null);
    setAsset("");
    setQuantity("");
    setUnitPrice("");
    setAdditionalCosts("0,00");
    setReserveAmount("");
    setReserveDescription("");
    setPurchaseCategory(purchaseCategories[0]?.id || "reserve_deposit");
    setMessage("");
    setIsContributionOpen(false);
    setReturnToCategory(null);
  };

  const startNewMovement = (category?: InvestmentCategoryId) => {
    clearEditor();
    setPurchaseCategory(category ? category === "opportunities" ? "reserve_deposit" : category : purchaseCategories[0]?.id || "reserve_deposit");
    setIsContributionOpen(true);
  };

  const toggleCategory = (categoryId: InvestmentCategoryId) => {
    if (categoryId === "opportunities") return;
    setSelectedCategoryIds((current) => current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId]);
    setTargets((current) => current[categoryId] !== undefined
      ? current
      : { ...current, [categoryId]: formatPercentValue(categories.find((category) => category.id === categoryId)?.defaultTarget || 0) });
    setMessage("");
  };

  const addCustomCategory = () => {
    const label = newCategoryName.trim();
    if (!label) return;
    if (categories.some((category) => category.label.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"))) {
      setMessage("Já existe uma categoria com esse nome.");
      return;
    }
    const baseId = `custom_${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "investimento"}`;
    let id = baseId;
    let suffix = 2;
    while (categories.some((category) => category.id === id)) id = `${baseId}_${suffix++}`;
    const newCategory = { id, label };
    setCategories((current) => [...current, newCategory]);
    setSelectedCategoryIds((current) => [...current, id]);
    setTargets((current) => ({ ...current, [id]: "0,00" }));
    setNewCategoryName("");
    setMessage("");
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!settingsAreValid || !isReady) return;
    setIsSaving(true);
    try {
      await saveInvestorSettings(groupId, year, month, {
        monthlyPlan: parsedMonthlyPlan,
        categories,
        selectedCategoryIds,
        targets: parsedTargets,
      });
      await refreshData();
      setIsPlanningOpen(false);
      onSaved?.();
      setMessage("Planejamento salvo. Esta configuração vale a partir deste mês.");
    } catch (error) {
      console.error("Erro ao salvar o planejamento de investimentos:", error);
      setMessage("Não foi possível salvar o planejamento. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInvestment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!movementIsValid || !editorMatchesSelection || !isReady) return;
    setIsSaving(true);
    try {
      if (isReserveSelected) {
        await saveReserveMovement(
          groupId,
          userId,
          editing?.year ?? year,
          editing?.month ?? month,
          editing?.monthId ?? monthId,
          {
            direction: reserveDirection,
            amountCents: toCents(parsedReserveAmount),
            description: reserveDescription,
          },
          editing?.type === "reserve" ? editing.id : undefined,
        );
      } else {
        await saveInvestmentPurchase(
          groupId,
          userId,
          editing?.year ?? year,
          editing?.month ?? month,
          editing?.monthId ?? monthId,
          {
            category: purchaseCategory as InvestmentPurchaseCategory,
            asset,
            quantity: parsedQuantity,
            unitPriceCents: toCents(parsedUnitPrice),
            additionalCostsCents: toCents(parsedCosts),
          },
          editing?.type === "purchase" ? editing.id : undefined,
        );
      }
      const wasEditing = editing?.type === expectedMovementType;
      const categoryToRestore = returnToCategory;
      await refreshData();
      clearEditor();
      if (categoryToRestore) {
        setSelectedCategory(categoryToRestore);
        setIsCategoryDialogOpen(true);
      }
      setMessage(wasEditing ? "Movimentação atualizada." : "Movimentação registrada.");
    } catch (error) {
      console.error("Erro ao salvar movimentação de investimento:", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a movimentação.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (movement: InvestorMovement) => {
    setEditing({ id: movement.id, type: movement.type, monthId: movement.monthId, year: movement.year, month: movement.month });
    setReturnToCategory(selectedCategory);
    setIsCategoryDialogOpen(false);
    setSelectedCategory(null);
    setIsContributionOpen(true);
    setMessage("");
      if (movement.type === "purchase") {
      setPurchaseCategory(movement.category || "stocks");
      setAsset(movement.asset || "");
      setQuantity(String(movement.quantity || ""));
      setUnitPrice(formatCurrencyValue((movement.unitPriceCents || 0) / 100));
      setAdditionalCosts(formatCurrencyValue((movement.additionalCostsCents || 0) / 100));
      setReserveAmount("");
      setReserveDescription("");
    } else if (movement.type === "reserve") {
      setPurchaseCategory(movement.direction === "withdrawal" ? "reserve_withdrawal" : "reserve_deposit");
      setReserveAmount(formatCurrencyValue(movement.amountCents / 100));
      setReserveDescription(movement.description || "");
      setAsset("");
      setQuantity("");
      setUnitPrice("");
      setAdditionalCosts("0,00");
    }
  };

  const closeContributionDialog = () => {
    const categoryToRestore = returnToCategory;
    clearEditor();
    if (categoryToRestore) {
      setSelectedCategory(categoryToRestore);
      setIsCategoryDialogOpen(true);
    }
  };

  const closeCategoryDialog = () => {
    setIsCategoryDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleDelete = async (movementId: string) => {
    setIsSaving(true);
    setMessage("");
    try {
      const movement = portfolioMovements.find((item) => item.id === movementId);
      if (!movement) throw new Error("A movimentação não foi encontrada.");
      await deleteInvestorMovement(groupId, movement.monthId, movementId);
      await refreshData();
      setDeleteConfirmId("");
      if (editing?.id === movementId) clearEditor();
      setMessage("Movimentação excluída.");
    } catch (error) {
      console.error("Erro ao excluir movimentação:", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir a movimentação.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`category-scroll max-h-[calc(100dvh-12rem)] ${evolutionExpanded ? "min-h-[420px]" : "min-h-0"} overflow-y-auto overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 pr-3 sm:p-8 sm:pr-6`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mt-1 text-2xl font-bold">Área do investidor</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => startNewMovement()} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"><Save size={16} /> Registrar aporte</button>
          <button type="button" onClick={() => setIsPlanningOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"><Settings2 size={16} /> Planejamento</button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      <section aria-label="Resumo da carteira" className="mb-5 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {distribution.rows.map((row) => {
            const portfolioTone = getAllocationTone(row.status);
            const isSelected = isCategoryDialogOpen && selectedCategory === row.id && categoryDetailScope === "month";
            const isReserveCard = row.id === "opportunities";
            const monthlyActualCents = isReserveCard
              ? portfolioSummary.monthlyReserveDepositsCents - portfolioSummary.monthlyReserveWithdrawalsCents
              : portfolioSummary.monthlyCategoryTotalsCents[row.id] || 0;
            const hasMonthlyActivity = isReserveCard
              ? portfolioSummary.monthlyReserveDepositsCents > 0 || portfolioSummary.monthlyReserveWithdrawalsCents > 0
              : monthlyActualCents > 0;
            const plannedAmountCents = distribution.startingRecommendations[row.id];
            const actualDifferenceCents = monthlyActualCents - plannedAmountCents;
            const actualToleranceCents = Math.max(1, Math.round(plannedAmountCents * 0.03));
            const actualStatus: AllocationStatus = actualDifferenceCents > actualToleranceCents
              ? "above"
              : actualDifferenceCents < -actualToleranceCents ? "below" : "on_target";
            const actualTone = getAllocationTone(actualStatus);
            const isReserveWithdrawal = isReserveCard && monthlyActualCents < 0;
            const isSuggestion = showRecommendations && !hasMonthlyActivity;
            const suggestionTone = {
              text: "text-sky-300",
              border: "border-sky-500/40",
              background: "bg-sky-500/5",
            };
            const cardTone = isSuggestion
              ? suggestionTone
              : showRecommendations && hasMonthlyActivity ? actualTone : portfolioTone;
            const cardAmountCents = showRecommendations
              ? hasMonthlyActivity ? Math.abs(monthlyActualCents) : distribution.recommended[row.id]
              : Math.abs(monthlyActualCents);
            const cardValueLabel = `${displaySummaryMoney(cardAmountCents)}${isSuggestion ? " (Sugestão para aportar)" : ""}`;
            const statusDescription = showRecommendations && hasMonthlyActivity
              ? isReserveWithdrawal ? "Utilização da reserva" : actualStatus === "on_target" ? "Aporte conforme a sugestão" : actualStatus === "below" ? "Aporte parcial" : "Acima da sugestão"
              : `${row.currentPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% - ${portfolioTone.label}`;
            return (
              <button key={row.id} type="button" aria-pressed={isSelected} aria-label={`${row.label}: ${cardValueLabel}`} onClick={() => { setSelectedCategory(row.id); setCategoryDetailScope("month"); setIsCategoryDialogOpen(true); }} className={`min-w-0 cursor-pointer rounded-xl border p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:ring-1 hover:ring-white/20 focus-visible:outline-2 focus-visible:outline-purple-400 sm:p-4 ${isSelected ? `ring-1 ring-purple-400/40 ${cardTone.border} ${cardTone.background}` : `${cardTone.border} ${cardTone.background}`}`}>
                <span className="block truncate text-xs text-zinc-400">{row.label}</span>
                <span className="mt-1 flex min-w-0 items-baseline gap-1.5 truncate text-base font-semibold tabular-nums text-white sm:text-lg">
                  <span className="truncate">{displaySummaryMoney(cardAmountCents)}</span>
                  {isSuggestion && <span className="shrink-0 text-[10px] font-medium text-sky-300 sm:text-xs">(Sugestão para aportar)</span>}
                </span>
                <span className={`mt-1 block truncate text-xs font-semibold tabular-nums ${cardTone.text}`}>{statusDescription}</span>
              </button>
            );
          })}
          <div aria-label="Saldo disponível para investimentos" className="min-w-0 rounded-xl border border-zinc-800 bg-black/20 p-3 sm:p-4">
            <span className="block truncate text-xs text-zinc-400">Saldo disponível</span>
            <span className={`mt-1 block truncate text-base font-semibold tabular-nums sm:text-lg ${monthlyBalanceCents < 0 ? "text-red-300" : "text-white"}`}>{displaySummaryMoney(monthlyBalanceCents)}</span>
            <span className="mt-1 block truncate text-[11px] text-zinc-500">Reserva separada: {displaySummaryMoney(portfolioSummary.reserveBalanceCents)}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="investor-cumulative-title" className={`mt-6 ${evolutionExpanded ? "border-t border-zinc-800 pt-5" : ""}`}>
        <div className={`flex items-center justify-between gap-3 ${evolutionExpanded ? "mb-3" : ""}`}>
          <div className="flex min-w-0 items-center gap-2">
            <h3 id="investor-cumulative-title" className="text-base font-semibold">Evolução dos investimentos</h3>
            <button type="button" onClick={openEvolutionCharts} aria-label="Abrir gráficos da evolução dos investimentos" title="Ver gráficos da evolução" className="shrink-0 rounded-lg p-2 text-purple-300 transition hover:bg-purple-500/10 hover:text-purple-200 focus-visible:outline-2 focus-visible:outline-purple-400">
              <BarChart3 size={19} aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => setEvolutionExpanded((expanded) => !expanded)} aria-expanded={evolutionExpanded} aria-controls="investor-evolution-cards" aria-label={evolutionExpanded ? "Minimizar evolução dos investimentos" : "Expandir evolução dos investimentos"} title={evolutionExpanded ? "Minimizar evolução dos investimentos" : "Expandir evolução dos investimentos"} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-400">
            {evolutionExpanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </button>
        </div>
        <div id="investor-evolution-cards" className={evolutionExpanded ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "hidden"}>
          {categories.filter((category) => selectedCategoryIds.includes(category.id) || (accumulatedInvestments[category.id] || 0) > 0).map((category) => {
            const cumulativeTotal = Object.values(accumulatedInvestments).reduce((total, amount) => total + amount, 0);
            const cumulativePct = cumulativeTotal > 0 ? (accumulatedInvestments[category.id] || 0) / cumulativeTotal * 100 : 0;
            const difference = cumulativePct - (savedTargets[category.id] || 0);
            const tone = getAllocationTone(difference > DISTRIBUTION_TOLERANCE_PCT ? "above" : difference < -DISTRIBUTION_TOLERANCE_PCT ? "below" : "on_target");
            return <button key={category.id} type="button" aria-pressed={isCategoryDialogOpen && selectedCategory === category.id && categoryDetailScope === "cumulative"} onClick={() => { setSelectedCategory(category.id); setCategoryDetailScope("cumulative"); setIsCategoryDialogOpen(true); }} className={`min-w-0 cursor-pointer rounded-xl border p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:ring-1 hover:ring-white/20 focus-visible:outline-2 focus-visible:outline-purple-400 sm:p-4 ${tone.border} ${tone.background}`}>
              <span className="block truncate text-xs text-zinc-400">{category.label}</span>
              <span className="mt-1 block truncate text-base font-semibold tabular-nums text-white sm:text-lg">{displaySummaryMoney(accumulatedInvestments[category.id] || 0)}</span>
              <span className={`mt-1 block truncate text-[11px] font-medium ${tone.text}`}>{cumulativePct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% - {tone.label}</span>
              {category.id === "opportunities" && <span className="mt-1 block truncate text-[11px] text-zinc-500">Aportes menos utilizações desde o início</span>}
            </button>;
          })}
        </div>
      </section>

      {isEvolutionChartOpen && (
        <ReportDetailDialog title="Evolução dos investimentos" busy={false} onClose={() => setIsEvolutionChartOpen(false)}>
          <div className="category-scroll max-h-[78dvh] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {chartCategories.length > 0 && (
              <fieldset className="rounded-xl border border-zinc-800 bg-black/20 p-3 sm:p-4">
                <div className="mb-2 flex justify-end">
                  <button type="button" onClick={() => setSelectedChartCategoryIds(chartCategories.map((category) => category.id))} className="text-xs font-medium text-purple-300 hover:text-purple-200">Selecionar todas</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chartCategories.map((category, index) => (
                    <label key={category.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                      <input type="checkbox" checked={selectedChartCategoryIds.includes(category.id)} onChange={() => setSelectedChartCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id])} className="accent-purple-500" />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} aria-hidden="true" />
                      {category.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {monthlyEvolution.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-8 text-center text-sm text-zinc-400">Registre seus primeiros aportes para ver a evolução em gráficos.</div>
            ) : selectedChartCategories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-8 text-center text-sm text-zinc-400">Selecione ao menos uma categoria para exibir os gráficos.</div>
            ) : (
              <>
                <section className="rounded-xl border border-zinc-800 bg-black/20 p-3 sm:p-4">
                  <h3 className="mb-3 text-sm font-semibold">Total acumulado por categoria</h3>
                  <div className="h-64 w-full sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyEvolution} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#a1a1aa" tick={{ fontSize: 10 }} tickFormatter={(value) => formatMoney(Number(value) / 100)} width={82} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, color: "#fff" }} formatter={(value, name) => [formatMoney(Number(value) / 100), String(name)]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {selectedChartCategories.map((category) => { const colorIndex = chartCategories.findIndex((item) => item.id === category.id); return <Line key={category.id} type="monotone" dataKey={category.id} name={category.label} stroke={CHART_COLORS[colorIndex % CHART_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />; })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-xl border border-zinc-800 bg-black/20 p-3 sm:p-4">
                    <h3 className="mb-3 text-sm font-semibold">Aportes registrados por mês</h3>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyEvolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" />
                          <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 9 }} />
                          <YAxis stroke="#a1a1aa" tick={{ fontSize: 10 }} tickFormatter={(value) => formatMoney(Number(value) / 100)} width={76} />
                          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, color: "#fff" }} formatter={(value, name) => [formatMoney(Number(value) / 100), String(name)]} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {selectedChartCategories.map((category) => { const colorIndex = chartCategories.findIndex((item) => item.id === category.id); return <Bar key={category.id} dataKey={`monthly_${category.id}`} name={category.label} fill={CHART_COLORS[colorIndex % CHART_COLORS.length]} stackId="monthly" />; })}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="rounded-xl border border-zinc-800 bg-black/20 p-3 sm:p-4">
                    <h3 className="mb-3 text-sm font-semibold">Distribuição acumulada</h3>
                    {selectedComposition.length === 0 ? <p className="py-16 text-center text-xs text-zinc-500">Sem valores acumulados nas categorias selecionadas.</p> : (
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={selectedComposition} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                              {selectedComposition.map((item) => { const colorIndex = chartCategories.findIndex((category) => category.id === item.id); return <Cell key={item.id} fill={CHART_COLORS[colorIndex % CHART_COLORS.length]} />; })}
                            </Pie>
                            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 10, color: "#fff" }} formatter={(value) => formatMoney(Number(value) / 100)} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        </ReportDetailDialog>
      )}

      {isContributionOpen && <ReportDetailDialog title={editing ? "Editar movimentação" : "Registrar aporte"} busy={isSaving} onClose={closeContributionDialog}>
      <div className="mb-4 text-sm text-zinc-400">Referência: {String(editing?.month ?? month).padStart(2, "0")}/{editing?.year ?? year}</div>
      <section className="rounded-xl border border-zinc-800 bg-black/20 p-4 sm:p-5" aria-labelledby="investor-purchases-title">
        <div className="mb-4">
          <h3 id="investor-purchases-title" className="text-lg font-semibold">Registrar compra ou movimentação</h3>
          <p className="mt-1 text-xs text-zinc-500">Escolha a categoria para exibir os campos correspondentes.</p>
        </div>
        <form onSubmit={handleSaveInvestment} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-400">Categoria</span>
            <select value={purchaseCategory} onChange={(event) => { setPurchaseCategory(event.target.value as InvestmentFormSelection); setMessage(""); }} disabled={!isReady || isSaving || !!editing} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400">
              {formPurchaseCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              <optgroup label="Reserva de oportunidades">
                <option value="reserve_deposit">Aporte na reserva</option>
                <option value="reserve_withdrawal">Utilização da reserva</option>
              </optgroup>
            </select>
          </label>
          {isReserveSelected ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Valor</span>
                <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-purple-400"><span className="pl-3 text-xs text-zinc-500">R$</span><input type="tel" inputMode="decimal" value={reserveAmount} onChange={(event) => setReserveAmount(formatCurrencyTyping(event.target.value))} placeholder="0,00" disabled={!isReady || isSaving} className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" /></div>
              </label>
              <label className="block sm:col-span-2 xl:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Descrição (opcional)</span>
                <input value={reserveDescription} onChange={(event) => setReserveDescription(event.target.value)} maxLength={120} placeholder="Ex.: transferência para reserva" disabled={!isReady || isSaving} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-400" />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Ativo</span>
                <input value={asset} onChange={(event) => setAsset(event.target.value.toUpperCase())} placeholder="Ex.: ITUB4" maxLength={20} disabled={!isReady || isSaving} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm uppercase text-white outline-none placeholder:text-zinc-600 focus:border-purple-400" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Quantidade</span>
                <input type="tel" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} placeholder="0" disabled={!isReady || isSaving} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-400" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Preço unitário</span>
                <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-purple-400"><span className="pl-3 text-xs text-zinc-500">R$</span><input type="tel" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(formatCurrencyTyping(event.target.value))} placeholder="0,00" disabled={!isReady || isSaving} className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" /></div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Custos adicionais</span>
                <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-purple-400"><span className="pl-3 text-xs text-zinc-500">R$</span><input type="tel" inputMode="decimal" value={additionalCosts} onChange={(event) => setAdditionalCosts(formatCurrencyTyping(event.target.value))} disabled={!isReady || isSaving} className="w-full bg-transparent px-2 py-2.5 text-sm text-white outline-none" /></div>
              </label>
            </>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 xl:col-span-5">
            <div className="text-sm text-zinc-400">{isReserveSelected ? "Valor da movimentação" : "Valor total da compra"}<strong className="ml-2 text-lg tabular-nums text-white">{formatMoney((isReserveSelected ? reserveIsValid ? toCents(parsedReserveAmount) : 0 : purchaseTotalCents) / 100)}</strong></div>
            <div className="flex gap-2">
              {editing && <button type="button" onClick={closeContributionDialog} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700"><X size={16} /> Cancelar</button>}
              <button type="submit" disabled={!isReady || !movementIsValid || isSaving || !editorMatchesSelection} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} /> {editing ? "Salvar alterações" : isReserveSelected ? "Registrar movimentação" : "Registrar compra"}</button>
            </div>
          </div>
        </form>
      </section>
      {message && !message.startsWith("Planejamento") && <p role={message.startsWith("Não foi") ? "alert" : "status"} className="mt-4 text-sm text-zinc-300">{message}</p>}
      </ReportDetailDialog>}

      {isCategoryDialogOpen && selectedCategory && (
        <ReportDetailDialog
          title={categories.find((category) => category.id === selectedCategory)?.label || "Investimentos"}
          busy={isSaving}
          onClose={closeCategoryDialog}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">{categoryDetailScope === "month" ? `Aportes de ${String(month).padStart(2, "0")}/${year}` : `Aportes acumulados até ${String(month).padStart(2, "0")}/${year}`}</p>
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs tabular-nums text-zinc-400">{categoryMovements.length} registros</span>
          </div>
          {categoryMovements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-black/20 p-6 text-center">
              <p className="text-sm text-zinc-400">Ainda não há investimentos nesta categoria.</p>
              {selectedCategory === "opportunities" || selectedCategoryIds.includes(selectedCategory)
                ? <button type="button" onClick={() => { const category = selectedCategory; closeCategoryDialog(); startNewMovement(category); }} className="mt-3 text-sm font-semibold text-purple-300 hover:text-purple-200">Registrar nesta categoria</button>
                : <p className="mt-3 text-xs text-zinc-500">Selecione esta categoria no planejamento mensal para registrar novos aportes.</p>}
            </div>
          ) : (
            <div className="category-scroll max-h-[60dvh] space-y-2 overflow-y-auto overscroll-contain pr-2">
              {categoryMovements.map((movement) => {
                const label = movement.type === "purchase"
                  ? movement.asset || "Ativo"
                  : movement.direction === "withdrawal" ? "Utilização da reserva" : "Aporte na reserva";
                const detail = movement.type === "purchase"
                  ? `${movement.quantity} un. × ${formatMoney((movement.unitPriceCents || 0) / 100)}${(movement.additionalCostsCents || 0) > 0 ? ` · custos ${formatMoney((movement.additionalCostsCents || 0) / 100)}` : ""}`
                  : movement.description || "Reserva de oportunidades";

                return (
                  <article key={movement.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-zinc-100">{label}</h3>
                        <p className="mt-1 truncate text-xs text-zinc-500">{String(movement.month).padStart(2, "0")}/{movement.year} · {detail}</p>
                      </div>
                      <strong className={`text-sm tabular-nums ${movement.type === "reserve" && movement.direction === "withdrawal" ? "text-amber-200" : "text-white"}`}>
                        {movement.type === "reserve" && movement.direction === "withdrawal" ? "− " : ""}{formatMoney(movement.amountCents / 100)}
                      </strong>
                      <div className="flex items-center gap-1">
                        {deleteConfirmId === movement.id ? (
                          <>
                            <span className="mr-1 text-xs text-red-200">Excluir?</span>
                            <button type="button" onClick={() => void handleDelete(movement.id)} disabled={isSaving} className="rounded-md bg-red-500/15 px-2 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25">Sim</button>
                            <button type="button" onClick={() => setDeleteConfirmId("")} disabled={isSaving} className="rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">Não</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditing(movement)} disabled={isSaving} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label={`Editar ${label}`} title="Editar"><Pencil size={15} /></button>
                            <button type="button" onClick={() => setDeleteConfirmId(movement.id)} disabled={isSaving} className="rounded-md p-2 text-zinc-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Excluir ${label}`} title="Excluir"><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ReportDetailDialog>
      )}

      {message && !isContributionOpen && !message.startsWith("Planejamento") && !message.startsWith("Não foi possível salvar o planejamento") && <p role={message.startsWith("Não foi") ? "alert" : "status"} className="mt-4 text-sm text-zinc-300">{message}</p>}
      {isSaving && <span className="sr-only" role="status">Salvando alterações</span>}

      {isPlanningOpen && (
        <ReportDetailDialog title="Planejamento mensal" busy={isSaving} onClose={() => setIsPlanningOpen(false)}>
          <p className="mb-4 text-sm text-zinc-400">As configurações de {String(month).padStart(2, "0")}/{year} preservam o planejamento dos meses anteriores.</p>
          <form onSubmit={handleSaveSettings} className="space-y-5" aria-busy={!isReady || isSaving}>
            <label className="block max-w-sm">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">Aporte mensal planejado</span>
              <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 focus-within:border-purple-400"><span className="pl-3 text-sm text-zinc-400">R$</span><input type="tel" inputMode="decimal" value={monthlyPlan} onChange={(event) => { setMonthlyPlan(formatCurrencyTyping(event.target.value)); setMessage(""); }} className="w-full bg-transparent px-3 py-2.5 text-white outline-none" aria-label="Aporte mensal planejado em reais" disabled={!isReady || isSaving} /></div>
            </label>
            <div>
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-zinc-200">Tipos de investimento</h3>
                <p className="mt-1 text-xs text-zinc-500">Selecione as categorias que farão parte do seu planejamento.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200">
                    <input type="checkbox" checked={category.id === "opportunities" || selectedCategoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} disabled={!isReady || isSaving || category.id === "opportunities"} className="accent-purple-500" />
                    <span>{category.label}{category.id === "opportunities" ? " · sempre incluída" : ""}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={40} placeholder="Adicionar outro tipo de investimento" disabled={!isReady || isSaving} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-purple-400" />
                <button type="button" onClick={addCustomCategory} disabled={!isReady || isSaving || !newCategoryName.trim()} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">Adicionar</button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">A Reserva de oportunidades permanece incluída. O percentual das categorias selecionadas deve somar 100%; categorias desmarcadas deixam de receber sugestões a partir deste mês.</p>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div><h3 className="text-sm font-semibold text-zinc-200">Percentual desejado por categoria</h3><p className="mt-1 text-xs text-zinc-500">A soma precisa ser exatamente 100%.</p></div>
                <span className={`text-sm font-semibold tabular-nums ${Math.abs(targetTotal - 100) < 0.000001 ? "text-emerald-300" : "text-amber-300"}`}>Total: {Number.isFinite(targetTotal) ? targetTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}%</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeCategories.map((category) => {
                  const percent = parsedTargets[category.id];
                  const plannedAmount = Number.isFinite(percent) && Number.isFinite(parsedMonthlyPlan) ? parsedMonthlyPlan * percent / 100 : 0;
                  return <label key={category.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"><span className="mb-2 block text-xs font-medium text-zinc-300">{category.label}</span><div className="flex items-center gap-2"><input type="tel" inputMode="decimal" value={targets[category.id]} onChange={(event) => { setTargets((current) => ({ ...current, [category.id]: formatPercentTyping(event.target.value) })); setMessage(""); }} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-right text-sm text-white outline-none focus:border-purple-400" aria-label={`${category.label}, percentual desejado`} disabled={!isReady || isSaving} /><span className="text-xs text-zinc-400">%</span><span className="min-w-20 text-right text-[11px] tabular-nums text-zinc-500">{formatMoney(plannedAmount)}</span></div></label>;
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
              <button type="submit" disabled={!isReady || !settingsAreValid || isSaving} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} /> Salvar planejamento</button>
              {!settingsAreValid && isReady && <p role="alert" className="text-xs text-amber-300">Selecione ao menos uma categoria e ajuste os percentuais selecionados para totalizar 100%.</p>}
              {(message.startsWith("Planejamento") || message.startsWith("Não foi possível salvar o planejamento")) && <p role={message.startsWith("Não foi") ? "alert" : "status"} className="text-xs text-zinc-300">{message}</p>}
            </div>
          </form>
        </ReportDetailDialog>
      )}

    </div>
  );
}
