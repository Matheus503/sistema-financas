import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

const defaultAccounts = [
  { name: "Salario (5-8)", type: "CREDIT" },
  { name: "Salario (13-15)", type: "CREDIT" },
  { name: "Gastos Matheus", type: "CREDIT" },
  { name: "Gastos Giovana", type: "CREDIT" },

  { name: "FIES (05)", type: "FIXED" },
  { name: "CONDOMINIO RP (10)", type: "FIXED" },

  { name: "Cartão Cred Nubank (19)", type: "VARIABLE" },
  { name: "Energia RP (13)", type: "VARIABLE" },
];

export const createMonth = async (
  year: number,
  month: number,
  userId: string
) => {
  const label = `${year}-${String(month).padStart(2, "0")}`;
  const monthsSnap = await getDocs(collection(db, "months"));

  let existingMonthId: string | null = null;
  let prevMonthDoc: any = null;

  monthsSnap.forEach((d) => {
    const data = d.data();

    if (data.year === year && data.month === month) {
      existingMonthId = d.id;
    }

    if (
      (data.year === year && data.month === month - 1) ||
      (month === 1 && data.year === year - 1 && data.month === 12)
    ) {
      prevMonthDoc = { id: d.id, ...data };
    }
  });

  if (existingMonthId) {
    return existingMonthId;
  }

  const monthRef = await addDoc(collection(db, "months"), {
    year,
    month,
    label,
    createdAt: serverTimestamp(),
    createdBy: userId,
    isClosed: false,
  });

  if (prevMonthDoc) {
    const prevAccounts = await getDocs(
      collection(db, "months", prevMonthDoc.id, "accounts")
    );

    const orderedAccounts = prevAccounts.docs
      .map((acc, index) => ({ acc, index, data: acc.data() }))
      .sort((a: any, b: any) => {
        const aOrder = Number.isFinite(Number(a.data.order))
          ? Number(a.data.order)
          : a.index;
        const bOrder = Number.isFinite(Number(b.data.order))
          ? Number(b.data.order)
          : b.index;

        if (a.data.type === b.data.type) return aOrder - bOrder;
        return a.index - b.index;
      });

    for (const item of orderedAccounts) {
      const data = item.data;

      await addDoc(collection(db, "months", monthRef.id, "accounts"), {
        name: data.name,
        type: data.type,
        value: Number(data.value || 0),
        isPaid: false,
        order: Number.isFinite(Number(data.order)) ? Number(data.order) : item.index,
      });
    }
  } else {
    for (const [index, acc] of defaultAccounts.entries()) {
      await addDoc(collection(db, "months", monthRef.id, "accounts"), {
        ...acc,
        value: 0,
        isPaid: false,
        order: index,
      });
    }
  }

  return monthRef.id;
};

export const getAllMonths = async () => {
  const snap = await getDocs(collection(db, "months"));

  const months = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return months.sort((a: any, b: any) => {
    if (a.year === b.year) return a.month - b.month;
    return a.year - b.year;
  });
};

