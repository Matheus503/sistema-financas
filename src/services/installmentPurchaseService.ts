import { db } from "../lib/firestore";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export type CreateInstallmentPurchaseData = {
  groupId: string;
  creditCardKey: string;
  cardName: string;
  dia_vencimento?: number;
  dia_fechamento: number;
  category: string;
  note: string;
  purchaseDate: string;
  firstYear: number;
  firstMonth: number;
  firstInstallmentNumber: number;
  totalPurchaseInstallments: number;
  installmentValuesCents: number[];
  userId: string;
  userName: string;
  launcherId: string;
  launcherName: string;
  installmentGroupId: string;
};

const removeUndefined = <T extends Record<string, unknown>>(data: T) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );

export const createInstallmentPurchase = async (
  data: CreateInstallmentPurchaseData
) => {
  await addDoc(
    collection(db, "installmentPurchases"),
    removeUndefined({
      ...data,
      isActive: true,
      createdAt: serverTimestamp(),
    })
  );
};
