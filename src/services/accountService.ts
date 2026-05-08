import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

type CreateAccountData = {
  name: string;
  type: "CREDIT" | "FIXED" | "VARIABLE" | string;
  value?: number;
  isPaid?: boolean;
  order?: number;
};

export const getAccountsByMonth = async (monthId: string) => {
  const snap = await getDocs(collection(db, "months", monthId, "accounts"));

  return snap.docs
    .map((docSnap, index) => ({
      id: docSnap.id,
      _index: index,
      ...docSnap.data(),
    }))
    .sort((a: any, b: any) => {
      const aOrder = Number.isFinite(Number(a.order)) ? Number(a.order) : a._index;
      const bOrder = Number.isFinite(Number(b.order)) ? Number(b.order) : b._index;

      if (a.type === b.type) return aOrder - bOrder;
      return a._index - b._index;
    })
    .map(({ _index, ...account }) => account);
};

export const createAccount = async (
  monthId: string,
  data: CreateAccountData
) => {
  const payload = {
    ...data,
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
