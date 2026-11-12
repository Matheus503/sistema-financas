import { investmentsRepository } from "../data/investmentsRepository";
import type {
  InvestmentPurchaseInput,
  InvestorSettings,
  ReserveMovementInput,
} from "../../../domain/finance/investment";

export function loadInvestmentPortfolio(
  groupId: string,
  year: number,
  month: number,
  monthId: string,
) {
  return investmentsRepository.getPortfolio(groupId, year, month, monthId);
}

export function loadInvestmentSettings(groupId: string, year: number, month: number) {
  return investmentsRepository.getSettings(groupId, year, month);
}

export function saveInvestmentPlan(
  groupId: string,
  year: number,
  month: number,
  settings: InvestorSettings,
) {
  return investmentsRepository.saveSettings(groupId, year, month, settings);
}

export function saveInvestmentPurchaseForMonth(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  purchase: InvestmentPurchaseInput,
  movementId?: string,
) {
  return investmentsRepository.savePurchase(
    groupId,
    userId,
    year,
    month,
    monthId,
    purchase,
    movementId,
  );
}

export function saveInvestmentReserveMovement(
  groupId: string,
  userId: string,
  year: number,
  month: number,
  monthId: string,
  movement: ReserveMovementInput,
  movementId?: string,
) {
  return investmentsRepository.saveReserveMovement(
    groupId,
    userId,
    year,
    month,
    monthId,
    movement,
    movementId,
  );
}

export function removeInvestmentMovement(
  groupId: string,
  monthId: string,
  movementId: string,
) {
  return investmentsRepository.deleteMovement(groupId, monthId, movementId);
}
