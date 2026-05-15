import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
} from "firebase/firestore";

export type AccountType = "CREDIT" | "FIXED" | "VARIABLE" | string;

export type FinanceAccount = {
  id: string;
  name: string;
  type: AccountType;
  value?: number;
  expectedValue?: number;
  isPaid?: boolean;
  order?: number;
  dia_vencimento?: number;
};

export const formatAccountNameWithDueDay = (
  account: Pick<FinanceAccount, "name" | "dia_vencimento">
) => {
  if (!account.dia_vencimento) return account.name;

  return `${account.name} - ${account.dia_vencimento}`;
};

type CreateAccountData = Omit<FinanceAccount, "id">;
type UpdateAccountData = {
  name: string;
  value: number;
  dia_vencimento?: number | null;
};

type AccountWithIndex = FinanceAccount & {
  _index: number;
  [key: string]: unknown;
};

const normalizeDueDay = (dia_vencimento: unknown) => {
  if (
    dia_vencimento === undefined ||
    dia_vencimento === null ||
    dia_vencimento === ""
  ) {
    return undefined;
  }

  const dueDay = Number(dia_vencimento);

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("dia_vencimento deve ser um numero de 1 a 31.");
  }

  return dueDay;
};

const withNormalizedDueDay = <T extends { dia_vencimento?: unknown }>(
  data: T
) => {
  const { dia_vencimento, ...rest } = data;
  const dueDay = normalizeDueDay(dia_vencimento);

  return dueDay === undefined ? rest : { ...rest, dia_vencimento: dueDay };
};

export const getAccountsByMonth = async (monthId: string) => {
  const snap = await getDocs(collection(db, "months", monthId, "accounts"));

  const accounts = snap.docs
    .map((docSnap, index) => {
      const data = docSnap.data();
      const dueDay = normalizeDueDay(data.dia_vencimento);

      return {
        id: docSnap.id,
        _index: index,
        ...data,
        ...(dueDay === undefined ? {} : { dia_vencimento: dueDay }),
      } as AccountWithIndex;
    })
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.order))
        ? Number(a.order)
        : a._index;
      const bOrder = Number.isFinite(Number(b.order))
        ? Number(b.order)
        : b._index;

      if (a.type === b.type) return aOrder - bOrder;
      return a._index - b._index;
    });

  return accounts.map((account) => {
    const result: Omit<AccountWithIndex, "_index"> & { _index?: number } = {
      ...account,
    };
    delete result._index;
    return result;
  });
};

export const createAccount = async (
  monthId: string,
  data: CreateAccountData
) => {
  const payload = {
    ...withNormalizedDueDay(data),
    value: Number(data.value || 0),
    isPaid: data.isPaid ?? false,
  };

  const docRef = await addDoc(
    collection(db, "months", monthId, "accounts"),
    payload
  );

  return { id: docRef.id, ...payload };
};

export const updateAccountValue = async (
  monthId: string,
  accountId: string,
  value: number
) => {
  await updateDoc(doc(db, "months", monthId, "accounts", accountId), {
    value,
  });
};

export const updateAccountExpectedValue = async (
  monthId: string,
  accountId: string,
  expectedValue: number
) => {
  await updateDoc(doc(db, "months", monthId, "accounts", accountId), {
    expectedValue,
  });
};

export const updateAccountDetails = async (
  monthId: string,
  accountId: string,
  data: UpdateAccountData
) => {
  const dueDay = normalizeDueDay(data.dia_vencimento);
  const payload = {
    name: data.name.trim(),
    value: Number(data.value || 0),
    dia_vencimento: dueDay ?? deleteField(),
  };

  await updateDoc(doc(db, "months", monthId, "accounts", accountId), payload);

  return dueDay === undefined
    ? { name: payload.name, value: payload.value, dia_vencimento: undefined }
    : { name: payload.name, value: payload.value, dia_vencimento: dueDay };
};

export const updateAccountDueDay = async (
  monthId: string,
  accountId: string,
  dia_vencimento?: number | null
) => {
  const dueDay = normalizeDueDay(dia_vencimento);

  await updateDoc(doc(db, "months", monthId, "accounts", accountId), {
    dia_vencimento: dueDay ?? deleteField(),
  });
};

export const updateAccountsOrder = async (
  monthId: string,
  accounts: { id: string; order: number }[]
) => {
  const batch = writeBatch(db);

  accounts.forEach((account) => {
    batch.update(doc(db, "months", monthId, "accounts", account.id), {
      order: account.order,
    });
  });

  await batch.commit();
};

export const toggleAccountPaid = async (
  monthId: string,
  accountId: string,
  current: boolean
) => {
  await updateDoc(doc(db, "months", monthId, "accounts", accountId), {
    isPaid: !current,
  });
};

export const deleteAccount = async (monthId: string, accountId: string) => {
  await deleteDoc(doc(db, "months", monthId, "accounts", accountId));
};
