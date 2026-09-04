import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export type AddTransactionPayload = {
  value: number;
  accountId: string;
  category: string;
  note: string;
  userId: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  date: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
};

export const addTransaction = async (
  monthId: string,
  data: AddTransactionPayload
) => {
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(
    collection(db, "months", monthId, "transactions"),
    payload
  );

  return {
    id: docRef.id,
    ...payload,
  };
};

export const getTransactions = async (monthId: string) => {
  const snap = await getDocs(collection(db, "months", monthId, "transactions"));

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

export const updateTransaction = async (
  monthId: string,
  transactionId: string,
  data: {
    value?: number;
    category?: string;
    note?: string;
    date?: string;
    accountId?: string;
    userId?: string;
    userName?: string;
    launcherId?: string;
    launcherName?: string;
  }
) => {
  await updateDoc(doc(db, "months", monthId, "transactions", transactionId), {
    ...data,
  });
};

export const deleteTransaction = async (
  monthId: string,
  transactionId: string
) => {
  await deleteDoc(doc(db, "months", monthId, "transactions", transactionId));
};
