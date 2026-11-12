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
  /** Unit price precision in 0.001 BRL; older purchases only have unitPriceCents. */
  unitPriceMilli?: number;
  additionalCostsCents?: number;
  direction?: "deposit" | "withdrawal";
  description?: string;
  amountCents: number;
  /** Reserve movement precision in 0.001 BRL; older movements only have amountCents. */
  amountMilli?: number;
};
export type InvestorPortfolioSummary = {
  monthlyCategoryTotalsCents: Record<InvestmentPurchaseCategory, number>;
  monthlyPurchasesCents: number;
  monthlyCashOutflowCents: number;
  monthlyBalanceImpactCents: number;
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
  unitPriceMilli: number;
  additionalCostsCents: number;
};
export type ReserveMovementInput = {
  direction: "deposit" | "withdrawal";
  amountMilli: number;
  description: string;
};

export const DEFAULT_INVESTOR_SETTINGS: InvestorSettings = {
  monthlyPlan: 1000,
  categories: INVESTMENT_CATEGORIES.map((category) => ({ ...category })),
  selectedCategoryIds: ["stocks", "fiis", "etfs", "opportunities"],
  targets: { stocks: 30, fiis: 25, etfs: 25, opportunities: 20 },
};
