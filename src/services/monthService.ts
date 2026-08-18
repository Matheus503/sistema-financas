import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  getCreditCardClosingDay,
  isCalculatedAccount,
  isPixAccount,
} from "./accountService";

const defaultAccounts = [
  { name: "Salario", type: "CREDIT" },
  { name: "Vale", type: "CREDIT" },

  { name: "Aluguel", type: "FIXED" },
  { name: "Condominio", type: "FIXED" },
  { name: "Financiamento AP", type: "FIXED" },

  {
    name: "Cartão de crédito principal",
    type: "VARIABLE",
    dia_vencimento: 19,
    dia_fechamento: 12,
    isCreditCard: true,
    isPrimaryCreditCard: true,
  },
  { name: "PIX", type: "VARIABLE", dia_fechamento: 12 },
  { name: "Conta de Energia", type: "VARIABLE" },
];

type MonthDoc = {
  id: string;
  year?: number;
  month?: number;
  [key: string]: unknown;
};

type AccountDoc = {
  id: string;
  index: number;
  data: {
    name?: unknown;
    type?: unknown;
    value?: unknown;
    order?: unknown;
    dia_vencimento?: unknown;
    dia_fechamento?: unknown;
    isCreditCard?: unknown;
    creditCardKey?: unknown;
    isArchived?: unknown;
    isPrimaryCreditCard?: unknown;
    installmentBaseName?: unknown;
    installmentCurrent?: unknown;
    installmentTotal?: unknown;
    installmentGroupId?: unknown;
  };
};

type InstallmentPurchaseDoc = {
  groupId?: unknown;
  creditCardKey?: unknown;
  cardName?: unknown;
  dia_vencimento?: unknown;
  dia_fechamento?: unknown;
  category?: unknown;
  note?: unknown;
  purchaseDate?: unknown;
  firstYear?: unknown;
  firstMonth?: unknown;
  firstInstallmentNumber?: unknown;
  totalPurchaseInstallments?: unknown;
  installmentValuesCents?: unknown;
  userId?: unknown;
  userName?: unknown;
  launcherId?: unknown;
  launcherName?: unknown;
  installmentGroupId?: unknown;
  isActive?: unknown;
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

const getValidInstallment = (value: unknown) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
};

const stripInstallmentSuffix = (name: string) =>
  name.replace(/\s*-\s*\d+\s*\/\s*\d+\s*$/, "").trim();

const getMonthDistance = (
  from: { year: number; month: number },
  to: { year: number; month: number }
) => (to.year - from.year) * 12 + (to.month - from.month);

const accountMatchesScheduledCard = (
  item: AccountDoc,
  scheduled: {
    creditCardKey: string;
    cardName: string;
    dueDay?: number;
    closingDay: number;
  }
) => {
  const accountKey =
    typeof item.data.creditCardKey === "string" && item.data.creditCardKey.trim()
      ? item.data.creditCardKey.trim()
      : item.id;

  if (
    scheduled.creditCardKey &&
    accountKey &&
    scheduled.creditCardKey === accountKey
  ) {
    return true;
  }

  return (
    item.data.name === scheduled.cardName &&
    getValidDueDay(item.data.dia_vencimento) === scheduled.dueDay &&
    getCreditCardClosingDay({
      name: String(item.data.name || ""),
      dia_fechamento: item.data.dia_fechamento as number | undefined,
      dia_vencimento: item.data.dia_vencimento as number | undefined,
    }) === scheduled.closingDay
  );
};

const createScheduledInstallmentTransactions = async (
  monthId: string,
  year: number,
  month: number,
  groupId: string
) => {
  const purchasesSnap = await getDocs(
    query(
      collection(db, "installmentPurchases"),
      where("groupId", "==", groupId)
    )
  );

  if (purchasesSnap.empty) return;

  const accountsSnap = await getDocs(collection(db, "months", monthId, "accounts"));
  const accounts = accountsSnap.docs.map(
    (acc, index) => ({ id: acc.id, index, data: acc.data() } as AccountDoc)
  );

  for (const purchaseDoc of purchasesSnap.docs) {
    const data = purchaseDoc.data() as InstallmentPurchaseDoc;
    if (data.isActive !== true) continue;

    const firstYear = Number(data.firstYear);
    const firstMonth = Number(data.firstMonth);
    const firstInstallmentNumber = Number(data.firstInstallmentNumber);
    const totalPurchaseInstallments = Number(data.totalPurchaseInstallments);
    const installmentValuesCents = Array.isArray(data.installmentValuesCents)
      ? data.installmentValuesCents.map(Number)
      : [];
    const installmentIndex = getMonthDistance(
      { year: firstYear, month: firstMonth },
      { year, month }
    );

    if (
      !Number.isInteger(firstYear) ||
      !Number.isInteger(firstMonth) ||
      !Number.isInteger(firstInstallmentNumber) ||
      !Number.isInteger(totalPurchaseInstallments) ||
      installmentIndex < 0 ||
      installmentIndex >= installmentValuesCents.length
    ) {
      continue;
    }

    const installmentValueCents = installmentValuesCents[installmentIndex];
    if (!Number.isFinite(installmentValueCents) || installmentValueCents <= 0) {
      continue;
    }

    const scheduledCard = {
      creditCardKey: String(data.creditCardKey || ""),
      cardName: String(data.cardName || ""),
      dueDay: getValidDueDay(data.dia_vencimento),
      closingDay: getValidDueDay(data.dia_fechamento) || 1,
    };

    let targetAccount = accounts.find((item) =>
      accountMatchesScheduledCard(item, scheduledCard)
    );

    if (!targetAccount) {
      const variableAccounts = accounts.filter(
        (item) => item.data.type === "VARIABLE"
      );
      const nextOrder =
        variableAccounts.length > 0
          ? Math.max(
              ...variableAccounts.map((item) =>
                Number.isFinite(Number(item.data.order))
                  ? Number(item.data.order)
                  : item.index
              )
            ) + 1
          : 0;

      const newAccountRef = await addDoc(
        collection(db, "months", monthId, "accounts"),
        {
          name: scheduledCard.cardName,
          type: "VARIABLE",
          value: 0,
          isPaid: false,
          order: nextOrder,
          ...(scheduledCard.dueDay === undefined
            ? {}
            : { dia_vencimento: scheduledCard.dueDay }),
          dia_fechamento: scheduledCard.closingDay,
          isCreditCard: true,
          ...(scheduledCard.creditCardKey
            ? { creditCardKey: scheduledCard.creditCardKey }
            : {}),
        }
      );

      targetAccount = {
        id: newAccountRef.id,
        index: accounts.length,
        data: {
          name: scheduledCard.cardName,
          type: "VARIABLE",
          value: 0,
          order: nextOrder,
          dia_vencimento: scheduledCard.dueDay,
          dia_fechamento: scheduledCard.closingDay,
          isCreditCard: true,
          creditCardKey: scheduledCard.creditCardKey,
        },
      };
      accounts.push(targetAccount);
    }

    const installmentCurrent = firstInstallmentNumber + installmentIndex;
    const rawNote = String(data.note || "").trim();
    const note = rawNote
      ? `${rawNote} (${installmentCurrent}/${totalPurchaseInstallments})`
      : `Parcela ${installmentCurrent}/${totalPurchaseInstallments}`;

    await addDoc(collection(db, "months", monthId, "transactions"), {
      value: installmentValueCents / 100,
      accountId: targetAccount.id,
      category: String(data.category || ""),
      note,
      userId: String(data.userId || ""),
      userName: String(data.userName || ""),
      launcherId: String(data.launcherId || ""),
      launcherName: String(data.launcherName || ""),
      date: String(data.purchaseDate || ""),
      installmentGroupId: String(data.installmentGroupId || purchaseDoc.id),
      installmentCurrent,
      installmentTotal: totalPurchaseInstallments,
      createdAt: serverTimestamp(),
    });
  }
};

export const createMonth = async (
  year: number,
  month: number,
  userId: string,
  groupId: string
) => {
  const label = `${year}-${String(month).padStart(2, "0")}`;
  const monthsSnap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", groupId))
  );

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
    groupId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    isClosed: false,
  });

  if (prevMonthDoc) {
    const prevAccounts = await getDocs(
      collection(db, "months", prevMonthDoc.id, "accounts")
    );

    const orderedAccounts = prevAccounts.docs
      .map((acc, index) => ({ id: acc.id, index, data: acc.data() } as AccountDoc))
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

    if (
      !orderedAccounts.some((item) =>
        isPixAccount({ name: String(item.data.name || "") })
      )
    ) {
      const maxVariableOrder = orderedAccounts
        .filter((item) => item.data.type === "VARIABLE")
        .reduce((maxOrder, item) => {
          const order = Number.isFinite(Number(item.data.order))
            ? Number(item.data.order)
            : item.index;

          return Math.max(maxOrder, order);
        }, -1);

      orderedAccounts.push({
        id: "",
        index: orderedAccounts.length,
        data: {
          name: "PIX",
          type: "VARIABLE",
          value: 0,
          dia_fechamento: 12,
          order: maxVariableOrder + 1,
        },
      });
    }

    for (const item of orderedAccounts) {
      const data = item.data;
      const dueDay = getValidDueDay(data.dia_vencimento);
      const closingDay = getValidDueDay(data.dia_fechamento);
      const isCreditCard = data.isCreditCard === true;
      const isArchived = data.isArchived === true;
      const isPrimaryCreditCard = data.isPrimaryCreditCard === true;
      const installmentTotal = getValidInstallment(data.installmentTotal);
      const installmentCurrent = getValidInstallment(data.installmentCurrent);
      const nextInstallmentCurrent =
        installmentTotal && installmentCurrent
          ? installmentCurrent + 1
          : undefined;

      if (isCreditCard && isArchived) {
        continue;
      }

      if (
        installmentTotal &&
        installmentCurrent &&
        installmentCurrent >= installmentTotal
      ) {
        continue;
      }

      const creditCardKey =
        typeof data.creditCardKey === "string" && data.creditCardKey.trim()
          ? data.creditCardKey.trim()
          : isCreditCard
          ? item.id
          : "";
      const value = isCalculatedAccount({ name: String(data.name || "") })
        ? 0
        : Number(data.value || 0);
      const installmentBaseName =
        typeof data.installmentBaseName === "string" &&
        data.installmentBaseName.trim()
          ? data.installmentBaseName.trim()
          : stripInstallmentSuffix(String(data.name || ""));
      const installmentGroupId =
        typeof data.installmentGroupId === "string" &&
        data.installmentGroupId.trim()
          ? data.installmentGroupId.trim()
          : item.id;
      const nextName =
        installmentTotal && nextInstallmentCurrent && installmentBaseName
          ? `${installmentBaseName} - ${nextInstallmentCurrent}/${installmentTotal}`
          : data.name;

      await addDoc(collection(db, "months", monthRef.id, "accounts"), {
        name: nextName,
        type: data.type,
        value,
        isPaid: false,
        order: Number.isFinite(Number(data.order))
          ? Number(data.order)
          : item.index,
        ...(dueDay === undefined ? {} : { dia_vencimento: dueDay }),
        ...(closingDay === undefined ? {} : { dia_fechamento: closingDay }),
        ...(isCreditCard ? { isCreditCard } : {}),
        ...(creditCardKey ? { creditCardKey } : {}),
        ...(isPrimaryCreditCard ? { isPrimaryCreditCard } : {}),
        ...(installmentTotal && nextInstallmentCurrent && installmentBaseName
          ? {
              installmentBaseName,
              installmentCurrent: nextInstallmentCurrent,
              installmentTotal,
              installmentGroupId,
            }
          : {}),
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

  await createScheduledInstallmentTransactions(monthRef.id, year, month, groupId);

  return monthRef.id;
};

export const getAllMonths = async (groupId: string) => {
  const snap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", groupId))
  );

  const months = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as MonthDoc[];

  return months.sort((a, b) => {
    if (a.year === b.year) return Number(a.month) - Number(b.month);
    return Number(a.year) - Number(b.year);
  });
};

