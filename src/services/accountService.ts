import { db } from "../lib/firestore";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
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
  dia_fechamento?: number;
  isCreditCard?: boolean;
  creditCardKey?: string;
  isArchived?: boolean;
  isPrimaryCreditCard?: boolean;
  installmentBaseName?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  installmentGroupId?: string;
};

export const formatAccountNameWithDueDay = (
  account: Pick<FinanceAccount, "name" | "dia_vencimento">
) => {
  if (!account.dia_vencimento) return account.name;

  return `${account.name} - ${account.dia_vencimento}`;
};

const normalizeAccountName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const isCreditCardAccount = (
  account: Pick<FinanceAccount, "name" | "isCreditCard"> | null | undefined
) => {
  if (account?.isCreditCard) return true;

  const normalizedName = normalizeAccountName(String(account?.name || ""));

  return (
    normalizedName.includes("nubank") &&
    normalizedName.includes("cartao") &&
    (normalizedName.includes("credito") || normalizedName.includes("cred"))
  );
};

export const getCreditCardClosingDay = (
  account:
    | Pick<FinanceAccount, "name" | "dia_fechamento" | "dia_vencimento">
    | null
    | undefined
) => {
  const closingDay = Number(account?.dia_fechamento);

  if (Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31) {
    return closingDay;
  }

  const normalizedName = normalizeAccountName(String(account?.name || ""));

  if (normalizedName.includes("nubank")) {
    return 12;
  }

  const dueDay = Number(account?.dia_vencimento);

  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
    ? dueDay
    : 1;
};

export const isPixAccount = (
  account: Pick<FinanceAccount, "name"> | null | undefined
) => normalizeAccountName(String(account?.name || "").trim()) === "pix";

export const getAccountClosingDay = (
  account:
    | Pick<FinanceAccount, "name" | "dia_fechamento" | "dia_vencimento">
    | null
    | undefined
) => {
  const closingDay = Number(account?.dia_fechamento);

  if (Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31) {
    return closingDay;
  }

  const normalizedName = normalizeAccountName(String(account?.name || ""));

  if (normalizedName.includes("nubank") || normalizedName === "pix") {
    return 12;
  }

  const dueDay = Number(account?.dia_vencimento);

  return Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31
    ? dueDay
    : 1;
};

export const isCalculatedAccount = (
  account: Pick<FinanceAccount, "name"> | null | undefined
) => isCreditCardAccount(account) || isPixAccount(account);

type CreateAccountData = Omit<FinanceAccount, "id">;
type UpdateAccountData = {
  name: string;
  value?: number;
  dia_vencimento?: number | null;
  dia_fechamento?: number | null;
  isArchived?: boolean;
  isPrimaryCreditCard?: boolean;
  installmentBaseName?: string | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  installmentGroupId?: string | null;
};

type AccountWithIndex = FinanceAccount & {
  _index: number;
  [key: string]: unknown;
};

type MonthDocData = {
  groupId?: unknown;
  year?: unknown;
  month?: unknown;
};

const normalizeDay = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const day = Number(value);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`${fieldName} deve ser um numero de 1 a 31.`);
  }

  return day;
};

const normalizeDueDay = (dia_vencimento: unknown) =>
  normalizeDay(dia_vencimento, "dia_vencimento");

const normalizeClosingDay = (dia_fechamento: unknown) =>
  normalizeDay(dia_fechamento, "dia_fechamento");

const normalizeInstallment = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const installment = Number(value);

  if (!Number.isInteger(installment) || installment < 1) {
    throw new Error(`${fieldName} deve ser um numero maior ou igual a 1.`);
  }

  return installment;
};

const withNormalizedDays = <
  T extends { dia_vencimento?: unknown; dia_fechamento?: unknown }
>(
  data: T
) => {
  const { dia_vencimento, dia_fechamento, ...rest } = data;
  const dueDay = normalizeDueDay(dia_vencimento);
  const closingDay = normalizeClosingDay(dia_fechamento);

  return {
    ...rest,
    ...(dueDay === undefined ? {} : { dia_vencimento: dueDay }),
    ...(closingDay === undefined ? {} : { dia_fechamento: closingDay }),
  };
};

const getMonthOrder = (month: MonthDocData) =>
  Number(month.year || 0) * 100 + Number(month.month || 0);

const stripInstallmentSuffix = (name: string) =>
  name.replace(/\s-\s\d+\/\d+$/, "").trim();

const accountMatchesCreditCard = (
  accountId: string,
  account: FinanceAccount,
  selectedId: string,
  selected: FinanceAccount
) => {
  const selectedKey = String(selected.creditCardKey || selectedId || "");
  const accountKey = String(account.creditCardKey || accountId || "");

  if (selectedKey && accountKey && selectedKey === accountKey) return true;

  return (
    account.name === selected.name &&
    Number(account.dia_vencimento || 0) === Number(selected.dia_vencimento || 0) &&
    getCreditCardClosingDay(account) === getCreditCardClosingDay(selected)
  );
};

const updatePrimaryCreditCardFromMonth = async (
  monthId: string,
  accountId: string,
  isPrimaryCreditCard: boolean,
  selectedAccount: FinanceAccount
) => {
  const monthSnap = await getDoc(doc(db, "months", monthId));
  if (!monthSnap.exists()) return;

  const currentMonth = monthSnap.data() as MonthDocData;
  const groupId = String(currentMonth.groupId || "");
  if (!groupId) return;

  const currentOrder = getMonthOrder(currentMonth);
  const monthsSnap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", groupId))
  );
  const batch = writeBatch(db);
  let hasUpdates = false;

  for (const monthDoc of monthsSnap.docs) {
    const month = monthDoc.data() as MonthDocData;
    if (getMonthOrder(month) < currentOrder) continue;

    const accountsSnap = await getDocs(
      collection(db, "months", monthDoc.id, "accounts")
    );

    accountsSnap.docs.forEach((accountDoc) => {
      const account = {
        id: accountDoc.id,
        ...accountDoc.data(),
      } as FinanceAccount;

      if (!isCreditCardAccount(account)) return;

      const isSelected = accountMatchesCreditCard(
        accountDoc.id,
        account,
        selectedAccount.id,
        selectedAccount
      );

      if (isPrimaryCreditCard) {
        batch.update(doc(db, "months", monthDoc.id, "accounts", accountDoc.id), {
          isPrimaryCreditCard: isSelected,
        });
        hasUpdates = true;
        return;
      }

      if (isSelected) {
        batch.update(doc(db, "months", monthDoc.id, "accounts", accountDoc.id), {
          isPrimaryCreditCard: false,
        });
        hasUpdates = true;
      }
    });
  }

  if (hasUpdates) {
    await batch.commit();
  }
};

const updateRelatedInstallmentAccounts = async (
  monthId: string,
  accountId: string,
  selectedAccount: FinanceAccount,
  installmentData:
    | {
        installmentBaseName: string;
        installmentCurrent: number;
        installmentTotal: number;
        installmentGroupId: string;
      }
    | null
) => {
  const monthSnap = await getDoc(doc(db, "months", monthId));
  if (!monthSnap.exists()) return;

  const currentMonth = monthSnap.data() as MonthDocData;
  const groupId = String(currentMonth.groupId || "");
  if (!groupId) return;

  const selectedGroupId =
    installmentData?.installmentGroupId ||
    selectedAccount.installmentGroupId ||
    accountId;
  const selectedBaseName =
    installmentData?.installmentBaseName ||
    selectedAccount.installmentBaseName ||
    stripInstallmentSuffix(String(selectedAccount.name || ""));

  if (!selectedGroupId && !selectedBaseName) return;

  const monthsSnap = await getDocs(
    query(collection(db, "months"), where("groupId", "==", groupId))
  );
  const batch = writeBatch(db);
  let hasUpdates = false;

  for (const monthDoc of monthsSnap.docs) {
    if (monthDoc.id === monthId) continue;

    const accountsSnap = await getDocs(
      collection(db, "months", monthDoc.id, "accounts")
    );

    accountsSnap.docs.forEach((accountDoc) => {
      const account = {
        id: accountDoc.id,
        ...accountDoc.data(),
      } as FinanceAccount;
      const accountGroupId = String(account.installmentGroupId || "");
      const accountBaseName =
        account.installmentBaseName || stripInstallmentSuffix(account.name || "");
      const isSameInstallment =
        (selectedGroupId && accountGroupId === selectedGroupId) ||
        (!accountGroupId &&
          account.type === selectedAccount.type &&
          accountBaseName === selectedBaseName);

      if (!isSameInstallment) return;

      const accountInstallmentCurrent = normalizeInstallment(
        account.installmentCurrent,
        "installmentCurrent"
      );

      if (!installmentData) {
        batch.update(doc(db, "months", monthDoc.id, "accounts", accountDoc.id), {
          name: accountBaseName,
          installmentBaseName: deleteField(),
          installmentCurrent: deleteField(),
          installmentTotal: deleteField(),
          installmentGroupId: deleteField(),
        });
        hasUpdates = true;
        return;
      }

      if (
        accountInstallmentCurrent === undefined ||
        accountInstallmentCurrent > installmentData.installmentTotal
      ) {
        return;
      }

      batch.update(doc(db, "months", monthDoc.id, "accounts", accountDoc.id), {
        name: `${installmentData.installmentBaseName} - ${accountInstallmentCurrent}/${installmentData.installmentTotal}`,
        installmentBaseName: installmentData.installmentBaseName,
        installmentCurrent: accountInstallmentCurrent,
        installmentTotal: installmentData.installmentTotal,
        installmentGroupId: installmentData.installmentGroupId,
      });
      hasUpdates = true;
    });
  }

  if (hasUpdates) {
    await batch.commit();
  }
};

export const getAccountsByMonth = async (monthId: string) => {
  const snap = await getDocs(collection(db, "months", monthId, "accounts"));

  const accounts = snap.docs
    .map((docSnap, index) => {
      const data = docSnap.data();
      const dueDay = normalizeDueDay(data.dia_vencimento);
      const closingDay = normalizeClosingDay(data.dia_fechamento);

      return {
        id: docSnap.id,
        _index: index,
        ...data,
        ...(dueDay === undefined ? {} : { dia_vencimento: dueDay }),
        ...(closingDay === undefined ? {} : { dia_fechamento: closingDay }),
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
  let payload = {
    ...withNormalizedDays(data),
    value: Number(data.value || 0),
    isPaid: data.isPaid ?? false,
  };

  const docRef = await addDoc(
    collection(db, "months", monthId, "accounts"),
    payload
  );

  if (payload.isCreditCard === true && !payload.creditCardKey) {
    payload = {
      ...payload,
      creditCardKey: docRef.id,
    };

    await updateDoc(docRef, {
      creditCardKey: docRef.id,
    });
  }

  if (payload.isCreditCard === true && payload.isPrimaryCreditCard === true) {
    const accountsSnap = await getDocs(
      collection(db, "months", monthId, "accounts")
    );
    const batch = writeBatch(db);

    accountsSnap.docs.forEach((accountDoc) => {
      const account = accountDoc.data();

      if (!isCreditCardAccount(account as FinanceAccount)) return;

      batch.update(doc(db, "months", monthId, "accounts", accountDoc.id), {
        isPrimaryCreditCard: accountDoc.id === docRef.id,
      });
    });

    await batch.commit();
  }

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
  const accountRef = doc(db, "months", monthId, "accounts", accountId);
  const accountSnap = await getDoc(accountRef);
  const selectedAccount = {
    id: accountId,
    ...(accountSnap.exists() ? accountSnap.data() : {}),
  } as FinanceAccount;
  const dueDay = normalizeDueDay(data.dia_vencimento);
  const closingDay = normalizeClosingDay(data.dia_fechamento);
  const installmentCurrent = normalizeInstallment(
    data.installmentCurrent,
    "installmentCurrent"
  );
  const installmentTotal = normalizeInstallment(
    data.installmentTotal,
    "installmentTotal"
  );
  const installmentBaseName =
    typeof data.installmentBaseName === "string" &&
    data.installmentBaseName.trim()
      ? data.installmentBaseName.trim()
      : undefined;
  const installmentGroupId =
    typeof data.installmentGroupId === "string" &&
    data.installmentGroupId.trim()
      ? data.installmentGroupId.trim()
      : undefined;
  const payload = {
    name: data.name.trim(),
    ...(data.value === undefined ? {} : { value: Number(data.value || 0) }),
    dia_vencimento: dueDay ?? deleteField(),
    dia_fechamento: closingDay ?? deleteField(),
    ...(data.installmentTotal === undefined
      ? {}
      : installmentTotal === undefined
      ? {
          installmentBaseName: deleteField(),
          installmentCurrent: deleteField(),
          installmentTotal: deleteField(),
          installmentGroupId: deleteField(),
        }
      : {
          installmentBaseName: installmentBaseName || data.name.trim(),
          installmentCurrent: installmentCurrent || 1,
          installmentTotal,
          ...(installmentGroupId ? { installmentGroupId } : {}),
        }),
    ...(data.isArchived === undefined ? {} : { isArchived: data.isArchived }),
    ...(data.isPrimaryCreditCard === undefined
      ? {}
      : { isPrimaryCreditCard: data.isPrimaryCreditCard }),
  };

  if (data.isPrimaryCreditCard === true) {
    const accountsSnap = await getDocs(
      collection(db, "months", monthId, "accounts")
    );
    const batch = writeBatch(db);

    accountsSnap.docs.forEach((accountDoc) => {
      const account = accountDoc.data();

      if (!isCreditCardAccount(account as FinanceAccount)) return;

      batch.update(
        doc(db, "months", monthId, "accounts", accountDoc.id),
        accountDoc.id === accountId ? payload : { isPrimaryCreditCard: false }
      );
    });

    await batch.commit();
  } else {
    await updateDoc(accountRef, payload);
  }

  if (data.isPrimaryCreditCard !== undefined) {
    await updatePrimaryCreditCardFromMonth(
      monthId,
      accountId,
      data.isPrimaryCreditCard,
      selectedAccount
    );
  }

  if (data.installmentTotal !== undefined) {
    await updateRelatedInstallmentAccounts(
      monthId,
      accountId,
      selectedAccount,
      installmentTotal === undefined
        ? null
        : {
            installmentBaseName: installmentBaseName || data.name.trim(),
            installmentCurrent: installmentCurrent || 1,
            installmentTotal,
            installmentGroupId: installmentGroupId || accountId,
          }
    );
  }

  return dueDay === undefined
    ? {
        name: payload.name,
        value: data.value,
        dia_vencimento: undefined,
        dia_fechamento: closingDay,
        isArchived: data.isArchived,
        isPrimaryCreditCard: data.isPrimaryCreditCard,
        installmentBaseName:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentBaseName || data.name.trim(),
        installmentCurrent:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentCurrent || 1,
        installmentTotal:
          data.installmentTotal === undefined ? undefined : installmentTotal,
        installmentGroupId:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentGroupId,
      }
    : {
        name: payload.name,
        value: data.value,
        dia_vencimento: dueDay,
        dia_fechamento: closingDay,
        isArchived: data.isArchived,
        isPrimaryCreditCard: data.isPrimaryCreditCard,
        installmentBaseName:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentBaseName || data.name.trim(),
        installmentCurrent:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentCurrent || 1,
        installmentTotal:
          data.installmentTotal === undefined ? undefined : installmentTotal,
        installmentGroupId:
          data.installmentTotal === undefined
            ? undefined
            : installmentTotal === undefined
            ? undefined
            : installmentGroupId,
      };
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
