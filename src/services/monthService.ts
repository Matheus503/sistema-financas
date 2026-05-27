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
  { name: "PIX", type: "VARIABLE" },
];

type MonthDoc = {
  id: string;
  year?: number;
  month?: number;
  [key: string]: unknown;
};

type AccountDoc = {
  index: number;
  data: {
    name?: unknown;
    type?: unknown;
    value?: unknown;
    order?: unknown;
    dia_vencimento?: unknown;
  };
};

const getValidDueDay = (dia_vencimento: unknown) => {
  if (
    dia_vencimento === undefined ||
    dia_vencimento === null ||
    dia_vencimento === ""
  ) {
    return undefined;
  }

  const dueDay = Number(dia_vencimento);

  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
    ? dueDay
    : undefined;
};

const isPixAccount = (name: unknown) => {
  return String(name || "").trim().toLowerCase() === "pix";
};

export const createMonth = async (
  year: number,
  month: number,
  userId: string
) => {
  const label = `${year}-${String(month).padStart(2, "0")}`;
  const monthsSnap = await getDocs(collection(db, "months"));

  const months = monthsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as MonthDoc[];

  const existingMonth = months.find(
    (item) => item.year === year && item.month === month
  );

  const prevMonthDoc = months.find(
    (item) =>
      (item.year === year && item.month === month - 1) ||
      (month === 1 && item.year === year - 1 && item.month === 12)
  );

  if (existingMonth) {
    return existingMonth.id;
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
      .map((acc, index) => ({ index, data: acc.data() } as AccountDoc))
      .sort((a, b) => {
        const aOrder = Number.isFinite(Number(a.data.order))
          ? Number(a.data.order)
          : a.index;
        const bOrder = Number.isFinite(Number(b.data.order))
          ? Number(b.data.order)
          : b.index;

        if (a.data.type === b.data.type) return aOrder - bOrder;
        return a.index - b.index;
      });

    if (!orderedAccounts.some((item) => isPixAccount(item.data.name))) {
      const maxVariableOrder = orderedAccounts
        .filter((item) => item.data.type === "VARIABLE")
        .reduce((maxOrder, item) => {
          const order = Number.isFinite(Number(item.data.order))
            ? Number(item.data.order)
            : item.index;

          return Math.max(maxOrder, order);
        }, -1);

      orderedAccounts.push({
        index: orderedAccounts.length,
        data: {
          name: "PIX",
          type: "VARIABLE",
          value: 0,
          order: maxVariableOrder + 1,
        },
      });
    }

    for (const item of orderedAccounts) {
      const data = item.data;
      const dueDay = getValidDueDay(data.dia_vencimento);

      await addDoc(collection(db, "months", monthRef.id, "accounts"), {
        name: data.name,
        type: data.type,
        value: Number(data.value || 0),
        isPaid: false,
        order: Number.isFinite(Number(data.order))
          ? Number(data.order)
          : item.index,
        ...(dueDay === undefined ? {} : { dia_vencimento: dueDay }),
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
  })) as MonthDoc[];

  return months.sort((a, b) => {
    if (a.year === b.year) return Number(a.month) - Number(b.month);
    return Number(a.year) - Number(b.year);
  });
};

