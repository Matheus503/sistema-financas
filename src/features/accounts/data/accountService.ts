import { localDate, validDate } from "../../../shared/date";
import {
  isCreditCardAccount,
  isInstallmentAccount,
  isPixAccount,
  getCreditCardClosingDay,
} from "../../../domain/finance/account";
import type { FinanceAccount } from "../../../domain/finance/account";
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
  type Firestore,
} from "firebase/firestore";

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
  selectedAccount: FinanceAccount,
  firestore: Firestore,
) => {
  const monthSnap = await getDoc(doc(firestore, "months", monthId));
  if (!monthSnap.exists()) return;

  const currentMonth = monthSnap.data() as MonthDocData;
  const groupId = String(currentMonth.groupId || "");
  if (!groupId) return;

  const currentOrder = getMonthOrder(currentMonth);
  const monthsSnap = await getDocs(
    query(collection(firestore, "months"), where("groupId", "==", groupId))
  );
  const batch = writeBatch(firestore);
  let hasUpdates = false;

  for (const monthDoc of monthsSnap.docs) {
    const month = monthDoc.data() as MonthDocData;
    if (getMonthOrder(month) < currentOrder) continue;

    const accountsSnap = await getDocs(
      collection(firestore, "months", monthDoc.id, "accounts")
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
        batch.update(doc(firestore, "months", monthDoc.id, "accounts", accountDoc.id), {
          isPrimaryCreditCard: isSelected,
        });
        hasUpdates = true;
        return;
      }

      if (isSelected) {
        batch.update(doc(firestore, "months", monthDoc.id, "accounts", accountDoc.id), {
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
    | null,
  firestore: Firestore,
) => {
  const monthSnap = await getDoc(doc(firestore, "months", monthId));
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
    query(collection(firestore, "months"), where("groupId", "==", groupId))
  );
  const batch = writeBatch(firestore);
  let hasUpdates = false;

  for (const monthDoc of monthsSnap.docs) {
    if (monthDoc.id === monthId) continue;

    const accountsSnap = await getDocs(
      collection(firestore, "months", monthDoc.id, "accounts")
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
        batch.update(doc(firestore, "months", monthDoc.id, "accounts", accountDoc.id), {
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

      batch.update(doc(firestore, "months", monthDoc.id, "accounts", accountDoc.id), {
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

export const getAccountsByMonth = async (
  monthId: string,
  firestore: Firestore,
): Promise<FinanceAccount[]> => {
  const snap = await getDocs(collection(firestore, "months", monthId, "accounts"));

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
    const result: FinanceAccount & { _index?: number } = {
      ...account,
    };
    delete result._index;
    return result;
  });
};

export const createAccount = async (
  monthId: string,
  data: CreateAccountData,
  firestore: Firestore,
) => {
  let payload = {
    ...withNormalizedDays(data),
    value: Number(data.value || 0),
    isPaid: data.isPaid ?? false,
  };

  const docRef = await addDoc(
    collection(firestore, "months", monthId, "accounts"),
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
      collection(firestore, "months", monthId, "accounts")
    );
    const batch = writeBatch(firestore);

    accountsSnap.docs.forEach((accountDoc) => {
      const account = accountDoc.data();

      if (!isCreditCardAccount(account as FinanceAccount)) return;

      batch.update(doc(firestore, "months", monthId, "accounts", accountDoc.id), {
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
  value: number,
  firestore: Firestore,
) => {
  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), {
    value,
  });
};

export const updateAccountExpectedValue = async (
  monthId: string,
  accountId: string,
  expectedValue: number,
  firestore: Firestore,
) => {
  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), {
    expectedValue,
  });
};

export const updateAccountDetails = async (
  monthId: string,
  accountId: string,
  data: UpdateAccountData,
  firestore: Firestore,
) => {
  const accountRef = doc(firestore, "months", monthId, "accounts", accountId);
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
      collection(firestore, "months", monthId, "accounts")
    );
    const batch = writeBatch(firestore);

    accountsSnap.docs.forEach((accountDoc) => {
      const account = accountDoc.data();

      if (!isCreditCardAccount(account as FinanceAccount)) return;

      batch.update(
        doc(firestore, "months", monthId, "accounts", accountDoc.id),
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
      selectedAccount,
      firestore,
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
          },
      firestore,
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
  dia_vencimento: number | null | undefined,
  firestore: Firestore,
) => {
  const dueDay = normalizeDueDay(dia_vencimento);

  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), {
    dia_vencimento: dueDay ?? deleteField(),
  });
};

export const updateAccountsOrder = async (
  monthId: string,
  accounts: { id: string; order: number }[],
  firestore: Firestore,
) => {
  const batch = writeBatch(firestore);

  accounts.forEach((account) => {
    batch.update(doc(firestore, "months", monthId, "accounts", account.id), {
      order: account.order,
    });
  });

  await batch.commit();
};

export const toggleAccountPaid = async (
  monthId: string,
  accountId: string,
  current: boolean,
  firestore: Firestore,
) => {
  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), {
    isPaid: !current,
    paidOn: current ? deleteField() : localDate(),
  });
};

export const updateCommonAccountDetails = async (
  monthId: string,
  accountId: string,
  data: { name: string; value: number; dia_vencimento?: number },
  firestore: Firestore,
) => {
  const name = data.name.trim();
  if (!name) throw new Error("Informe o nome da conta.");
  if (!Number.isFinite(data.value) || data.value < 0) {
    throw new Error("Informe um valor inicial válido.");
  }
  const dueDay = normalizeDueDay(data.dia_vencimento);
  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), {
    name,
    value: data.value,
    dia_vencimento: dueDay ?? deleteField(),
  });
};

export const updateAccountPaidOn = async (monthId: string, accountId: string, paidOn: string, firestore: Firestore) => {
  if (!validDate(paidOn) || paidOn > localDate()) throw new Error("Informe uma data válida, até hoje.");
  await updateDoc(doc(firestore, "months", monthId, "accounts", accountId), { paidOn });
};

export const deleteAccount = async (monthId: string, accountId: string, firestore: Firestore) => {
  const accountRef = doc(firestore, "months", monthId, "accounts", accountId);
  const accountSnap = await getDoc(accountRef);

  if (!accountSnap.exists()) {
    await deleteDoc(accountRef);
    return;
  }

  const account = {
    id: accountSnap.id,
    ...accountSnap.data(),
  } as FinanceAccount;
  const installmentTotal = normalizeInstallment(
    account.installmentTotal,
    "installmentTotal"
  );
  const installmentCurrent = normalizeInstallment(
    account.installmentCurrent,
    "installmentCurrent"
  );
  const installmentGroupId = String(account.installmentGroupId || "");

  if (!installmentTotal || !installmentCurrent || !installmentGroupId) {
    await deleteDoc(accountRef);
    return;
  }

  const monthSnap = await getDoc(doc(firestore, "months", monthId));
  const monthData = monthSnap.data() as MonthDocData | undefined;
  const groupId = String(monthData?.groupId || "");
  const currentOrder =
    Number(monthData?.year || 0) * 100 + Number(monthData?.month || 0);

  if (!groupId || !currentOrder) {
    await deleteDoc(accountRef);
    return;
  }

  const monthsSnap = await getDocs(
    query(collection(firestore, "months"), where("groupId", "==", groupId))
  );
  const batch = writeBatch(firestore);
  let hasDeletes = false;

  for (const monthDoc of monthsSnap.docs) {
    const data = monthDoc.data() as MonthDocData;
    const monthOrder = Number(data.year || 0) * 100 + Number(data.month || 0);

    if (monthOrder < currentOrder) continue;

    const accountsSnap = await getDocs(
      collection(firestore, "months", monthDoc.id, "accounts")
    );

    accountsSnap.docs.forEach((item) => {
      const itemData = item.data() as FinanceAccount;

      if (String(itemData.installmentGroupId || "") !== installmentGroupId) {
        return;
      }

      const itemInstallmentCurrent = normalizeInstallment(
        itemData.installmentCurrent,
        "installmentCurrent"
      );

      if (
        itemInstallmentCurrent !== undefined &&
        itemInstallmentCurrent < installmentCurrent
      ) {
        return;
      }

      batch.delete(doc(firestore, "months", monthDoc.id, "accounts", item.id));
      hasDeletes = true;
    });
  }

  if (hasDeletes) {
    await batch.commit();
  }
};

export const deleteCommonAccount = async (
  monthId: string,
  accountId: string,
  firestore: Firestore,
) => {
  const accountRef = doc(firestore, "months", monthId, "accounts", accountId);
  const accountSnap = await getDoc(accountRef);
  if (!accountSnap.exists()) return;

  const account = { id: accountId, ...accountSnap.data() } as FinanceAccount;
  if (isCreditCardAccount(account) || isPixAccount(account) || isInstallmentAccount(account)) {
    throw new Error("Contas de cartão, PIX ou parceladas exigem o fluxo de exclusão específico.");
  }

  await deleteDoc(accountRef);
};
