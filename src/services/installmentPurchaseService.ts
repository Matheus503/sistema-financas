import { db } from "../lib/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

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

type AnticipateInstallmentPurchaseData = {
  groupId: string;
  currentMonthId: string;
  installmentGroupId: string;
  currentInstallment: number;
  installmentsToAnticipate: number;
  originalAmount: number;
  paidAmount: number;
  discountAmount: number;
  accountId: string;
  category: string;
  baseNote: string;
  date: string;
  userId: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
};

type CancelInstallmentPurchaseData = {
  groupId: string;
  currentMonthId: string;
  installmentGroupId: string;
  currentInstallment: number;
};

const addMonths = (
  value: { year: number; month: number },
  amount: number
) => {
  const zeroBasedMonth = value.month - 1 + amount;

  return {
    year: value.year + Math.floor(zeroBasedMonth / 12),
    month: (zeroBasedMonth % 12) + 1,
  };
};

export const anticipateInstallmentPurchase = async (
  data: AnticipateInstallmentPurchaseData
) => {
  const purchasesSnap = await getDocs(
    query(
      collection(db, "installmentPurchases"),
      where("groupId", "==", data.groupId)
    )
  );

  const purchaseDoc = purchasesSnap.docs.find(
    (item) => item.data().installmentGroupId === data.installmentGroupId
  );
  if (!purchaseDoc) {
    throw new Error("Compra parcelada não encontrada.");
  }

  const purchase = purchaseDoc.data();
  const firstInstallmentNumber = Number(purchase.firstInstallmentNumber || 2);
  const firstYear = Number(purchase.firstYear);
  const firstMonth = Number(purchase.firstMonth);
  const installmentValuesCents = Array.isArray(purchase.installmentValuesCents)
    ? purchase.installmentValuesCents.map(Number)
    : [];
  const firstAnticipatedInstallment = data.currentInstallment + 1;
  const startIndex = Math.max(
    firstAnticipatedInstallment - firstInstallmentNumber,
    0
  );
  const remainingAfterAnticipationIndex =
    startIndex + data.installmentsToAnticipate;
  const anticipatedValuesCents = installmentValuesCents.slice(
    startIndex,
    remainingAfterAnticipationIndex
  );
  const anticipatedOriginalAmount =
    anticipatedValuesCents.reduce((sum, value) => sum + value, 0) / 100;
  const anticipatedDiscountAmount = Math.max(
    anticipatedOriginalAmount - data.paidAmount,
    0
  );
  const remainingValuesCents = installmentValuesCents.slice(
    remainingAfterAnticipationIndex
  );
  const currentMonthSnap = await getDoc(doc(db, "months", data.currentMonthId));
  const currentMonthData = currentMonthSnap.data();
  const currentYear = Number(currentMonthData?.year);
  const currentMonth = Number(currentMonthData?.month);
  const nextScheduleMonth =
    Number.isInteger(currentYear) && Number.isInteger(currentMonth)
      ? addMonths({ year: currentYear, month: currentMonth }, 1)
      : addMonths(
          { year: firstYear, month: firstMonth },
          remainingAfterAnticipationIndex
        );
  const isFullyAnticipated = remainingValuesCents.length === 0;

  await updateDoc(doc(db, "installmentPurchases", purchaseDoc.id), {
    isActive: !isFullyAnticipated,
    status: isFullyAnticipated ? "anticipated" : "partially_anticipated",
    anticipatedAt: serverTimestamp(),
    anticipatedMonthId: data.currentMonthId,
    anticipatedAccountId: data.accountId,
    anticipatedInstallments: data.installmentsToAnticipate,
    anticipatedOriginalAmount,
    anticipatedPaidAmount: data.paidAmount,
    anticipatedDiscountAmount,
    ...(isFullyAnticipated
      ? {}
      : {
          firstYear: nextScheduleMonth.year,
          firstMonth: nextScheduleMonth.month,
          firstInstallmentNumber:
            firstAnticipatedInstallment + data.installmentsToAnticipate,
          installmentValuesCents: remainingValuesCents,
        }),
    updatedAt: serverTimestamp(),
  });

  const baseNote = data.baseNote.trim() || "Compra parcelada";
  const totalPurchaseInstallments = Number(
    purchase.totalPurchaseInstallments || data.currentInstallment
  );

  await Promise.all(
    anticipatedValuesCents.map((installmentValueCents, index) => {
      const installmentCurrent = firstAnticipatedInstallment + index;

      return addDoc(
        collection(db, "months", data.currentMonthId, "transactions"),
        {
          value: installmentValueCents / 100,
          accountId: data.accountId,
          category: data.category,
          note: `${baseNote} (${installmentCurrent}/${totalPurchaseInstallments})`,
          userId: data.userId,
          userName: data.userName || "",
          launcherId: data.launcherId || data.userId,
          launcherName: data.launcherName || data.userName || "",
          date: data.date,
          installmentGroupId: data.installmentGroupId,
          installmentCurrent,
          installmentTotal: totalPurchaseInstallments,
          transactionType: "installment_anticipation_installment",
          createdAt: serverTimestamp(),
        }
      );
    })
  );

  if (anticipatedDiscountAmount > 0) {
    await addDoc(collection(db, "months", data.currentMonthId, "transactions"), {
      value: -anticipatedDiscountAmount,
      accountId: data.accountId,
      category: "Desconto antecipação",
      note: `${data.category} - ${baseNote}`,
      userId: data.userId,
      userName: data.userName || "",
      launcherId: data.launcherId || data.userId,
      launcherName: data.launcherName || data.userName || "",
      date: data.date,
      installmentGroupId: data.installmentGroupId,
      transactionType: "installment_anticipation_discount",
      createdAt: serverTimestamp(),
    });
  }

  const monthsSnap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", data.groupId))
  );

  const lastAnticipatedInstallment =
    data.currentInstallment + data.installmentsToAnticipate;

  await Promise.all(
    monthsSnap.docs.map(async (monthDoc) => {
      const transactionsSnap = await getDocs(
        query(
          collection(db, "months", monthDoc.id, "transactions"),
          where("installmentGroupId", "==", data.installmentGroupId)
        )
      );

      await Promise.all(
        transactionsSnap.docs.map(async (transactionDoc) => {
          const transaction = transactionDoc.data();
          const installmentCurrent = Number(transaction.installmentCurrent || 0);

          if (
            transaction.transactionType !==
              "installment_anticipation_installment" &&
            installmentCurrent > data.currentInstallment &&
            installmentCurrent <= lastAnticipatedInstallment
          ) {
            await deleteDoc(
              doc(db, "months", monthDoc.id, "transactions", transactionDoc.id)
            );
          }
        })
      );
    })
  );
};

export const cancelInstallmentPurchaseFromInstallment = async (
  data: CancelInstallmentPurchaseData
) => {
  const purchasesSnap = await getDocs(
    query(
      collection(db, "installmentPurchases"),
      where("groupId", "==", data.groupId)
    )
  );

  const purchaseDoc = purchasesSnap.docs.find(
    (item) => item.data().installmentGroupId === data.installmentGroupId
  );

  if (purchaseDoc) {
    await updateDoc(doc(db, "installmentPurchases", purchaseDoc.id), {
      isActive: false,
      status: "canceled",
      canceledAt: serverTimestamp(),
      canceledMonthId: data.currentMonthId,
      canceledFromInstallment: data.currentInstallment,
      updatedAt: serverTimestamp(),
    });
  }

  const monthsSnap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", data.groupId))
  );

  await Promise.all(
    monthsSnap.docs.map(async (monthDoc) => {
      const transactionsSnap = await getDocs(
        query(
          collection(db, "months", monthDoc.id, "transactions"),
          where("installmentGroupId", "==", data.installmentGroupId)
        )
      );

      await Promise.all(
        transactionsSnap.docs.map(async (transactionDoc) => {
          const transaction = transactionDoc.data();
          const installmentCurrent = Number(transaction.installmentCurrent || 0);

          if (installmentCurrent >= data.currentInstallment) {
            await deleteDoc(
              doc(db, "months", monthDoc.id, "transactions", transactionDoc.id)
            );
          }
        })
      );
    })
  );
};
