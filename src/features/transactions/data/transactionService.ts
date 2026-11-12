import { isCreditCardAccount, type FinanceAccount } from "../../../domain/finance/account";
import type { AddTransactionPayload, FinanceTransaction } from "../../../domain/finance/transaction";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  runTransaction,
  type Firestore,
} from "firebase/firestore";

export async function linkUnclassifiedTransaction(monthId: string, transactionId: string, accountId: string, firestore: Firestore) {
  return runTransaction(firestore, async transaction => {
    const entryRef = doc(firestore, "months", monthId, "transactions", transactionId);
    const accountRef = doc(firestore, "months", monthId, "accounts", accountId);
    const entrySnap = await transaction.get(entryRef);
    const accountSnap = await transaction.get(accountRef);
    if (!entrySnap.exists() || !accountSnap.exists()) throw new Error("Lançamento ou conta não encontrado. Atualize a página.");
    const entry = entrySnap.data();
    const account = { ...accountSnap.data(), id: accountId } as FinanceAccount;
    if (!["CREDIT", "FIXED", "VARIABLE"].includes(account.type)) throw new Error("Selecione uma conta com tipo válido.");
    const oldRef = typeof entry.accountId === "string" && entry.accountId ? doc(firestore, "months", monthId, "accounts", entry.accountId) : null;
    const oldSnap = oldRef ? await transaction.get(oldRef) : null;
    const old = oldSnap?.exists() ? oldSnap.data() as FinanceAccount : null;
    if (old && ["CREDIT", "FIXED", "VARIABLE"].includes(old.type)) throw new Error("Este lançamento já possui uma conta identificada. Atualize a página.");
    const value = Number(entry.value);
    if (!Number.isFinite(value)) throw new Error("O lançamento tem um valor inválido.");
    if (!isCreditCardAccount(account)) {
      const base = Number(account.value || 0);
      if (!Number.isFinite(base)) throw new Error("A conta tem um valor inválido.");
      transaction.update(accountRef, { value: (Math.round(base * 100) + Math.round(value * 100)) / 100 });
    }
    if (old && oldRef && !isCreditCardAccount(old)) {
      const base = Number(old.value || 0);
      if (!Number.isFinite(base)) throw new Error("A conta anterior tem um valor inválido.");
      transaction.update(oldRef, { value: (Math.round(base * 100) - Math.round(value * 100)) / 100 });
    }
    transaction.update(entryRef, { accountId });
    return account;
  });
}

export const addTransaction = async (
  monthId: string,
  data: AddTransactionPayload,
  firestore: Firestore,
) => {
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(
    collection(firestore, "months", monthId, "transactions"),
    payload
  );

  return {
    id: docRef.id,
    ...payload,
  };
};

export const getTransactions = async (
  monthId: string,
  firestore: Firestore,
): Promise<FinanceTransaction[]> => {
  const snap = await getDocs(collection(firestore, "months", monthId, "transactions"));

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
  },
  firestore: Firestore,
) => {
  await updateDoc(doc(firestore, "months", monthId, "transactions", transactionId), {
    ...data,
  });
};

export const deleteTransaction = async (
  monthId: string,
  transactionId: string,
  firestore: Firestore,
) => {
  await deleteDoc(doc(firestore, "months", monthId, "transactions", transactionId));
};
