import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

type CreateAccountData = {
  name: string;
  type: "CREDIT" | "FIXED" | "VARIABLE" | string;
  value?: number;
  isPaid?: boolean;
};

export const getAccountsByMonth = async (monthId: string) => {
  const snap = await getDocs(collection(db, "months", monthId, "accounts"));

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
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