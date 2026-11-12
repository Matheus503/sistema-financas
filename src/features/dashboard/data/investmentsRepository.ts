import {
  deleteInvestorMovement,
  getInvestorPortfolioData,
  getInvestorSettings,
  saveInvestmentPurchase,
  saveInvestorSettings,
  saveReserveMovement,
} from "./investmentService";
import { db } from "../../../lib/firestore";

export const investmentsRepository = {
  getPortfolio: (groupId: string, year: number, month: number, monthId: string) =>
    getInvestorPortfolioData(groupId, year, month, monthId, db),
  getSettings: (groupId: string, year: number, month: number) =>
    getInvestorSettings(groupId, year, month, db),
  saveSettings: (groupId: string, year: number, month: number, settings: Parameters<typeof saveInvestorSettings>[3]) =>
    saveInvestorSettings(groupId, year, month, settings, db),
  savePurchase: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    purchase: Parameters<typeof saveInvestmentPurchase>[5],
    movementId?: string,
  ) => saveInvestmentPurchase(groupId, userId, year, month, monthId, purchase, movementId, db),
  saveReserveMovement: (
    groupId: string,
    userId: string,
    year: number,
    month: number,
    monthId: string,
    movement: Parameters<typeof saveReserveMovement>[5],
    movementId?: string,
  ) => saveReserveMovement(groupId, userId, year, month, monthId, movement, movementId, db),
  deleteMovement: (groupId: string, monthId: string, movementId: string) =>
    deleteInvestorMovement(groupId, monthId, movementId, db),
};
