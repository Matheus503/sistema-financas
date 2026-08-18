"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { auth } from "../lib/auth";
import {
  addTransaction,
  getTransactions,
} from "../services/transactionService";

import {
  createAccount,
  getAccountClosingDay,
  getCreditCardClosingDay,
  getAccountsByMonth,
  isCreditCardAccount,
  isPixAccount,
  updateAccountValue,
} from "../services/accountService";

import type { FinanceAccount } from "../services/accountService";

import {
  createMonth,
  getAllMonths,
} from "../services/monthService";
import { createInstallmentPurchase } from "../services/installmentPurchaseService";
import { ensureUserProfile } from "../services/userService";
import {
  createCategory,
  deleteCategory,
  seedDefaultCategoriesForGroup,
  type FinanceCategory,
  updateCategoryName,
} from "../services/categoryService";

type MonthDoc = {
  id: string;
  year: number;
  month: number;
};

type TransactionRecord = {
  id: string;
  accountId?: string;
  value?: number;
  date?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  monthId: string | null;
  accounts: FinanceAccount[];
  setAccounts: React.Dispatch<
    React.SetStateAction<FinanceAccount[]>
  >;
  setTransactions: React.Dispatch<
    React.SetStateAction<TransactionRecord[]>
  >;
  onMonthsChanged?: (
    targetMonthId: string
  ) => Promise<void>;
  onSaved?: (
    targetMonthId: string
  ) => Promise<void> | void;
};

const resolveLauncherName = () => {
  return (
    auth.currentUser?.displayName?.split(
      " "
    )[0] ||
    auth.currentUser?.email?.split(
      "@"
    )[0] ||
    ""
  );
};

const getCategorySeedPreset = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  return [
    "matheus.gomesmoreira@gmail.com",
    "giovana.bonardi96@gmail.com",
  ].includes(normalizedEmail)
    ? "legacy"
    : "generic";
};

const getTodayDateKey = () => {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getInvoiceMonth = (dateKey: string, closingDay: number) => {
  const [year, month, day] =
    dateKey
      .split("-")
      .map(Number);

  if (day >= closingDay) {
    return {
      year:
        month === 12
          ? year + 1
          : year,

      month:
        month === 12
          ? 1
          : month + 1,
    };
  }

  return { year, month };
};

const addMonthsToInvoice = (
  invoiceMonth: { year: number; month: number },
  offset: number
) => {
  const zeroBasedMonth = invoiceMonth.month - 1 + offset;

  return {
    year: invoiceMonth.year + Math.floor(zeroBasedMonth / 12),
    month: (zeroBasedMonth % 12) + 1,
  };
};

const splitCurrencyInCents = (totalValue: number, installments: number) => {
  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;

  return Array.from({ length: installments }, (_, index) =>
    baseCents + (index < remainder ? 1 : 0)
  );
};

const getInstallmentGroupId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCreditCardKey = (account: FinanceAccount) =>
  String(account.creditCardKey || account.id || "");

const matchesSelectedCreditCard = (
  account: FinanceAccount,
  selected: FinanceAccount
) => {
  if (!isCreditCardAccount(account)) return false;

  const selectedKey = getCreditCardKey(selected);
  const accountKey = getCreditCardKey(account);

  if (selectedKey && accountKey && selectedKey === accountKey) {
    return true;
  }

  return (
    account.name === selected.name &&
    Number(account.dia_vencimento || 0) === Number(selected.dia_vencimento || 0) &&
    getCreditCardClosingDay(account) === getCreditCardClosingDay(selected)
  );
};

// 🔥 FORMATA MOEDA DIGITANDO
const formatCurrencyInput = (
  value: string
) => {
  const numbers = value.replace(
    /\D/g,
    ""
  );

  const amount =
    Number(numbers) / 100;

  return amount.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
};

// 🔥 CONVERTE PRA NUMBER
const parseCurrency = (
  v: string
) => {
  if (!v) return 0;

  return Number(
    v
      .replace(/\./g, "")
      .replace(",", ".")
  );
};

export default function LaunchModal({
  open,
  onClose,
  monthId,
  accounts,
  setAccounts,
  setTransactions,
  onMonthsChanged,
  onSaved,
}: Props) {
  const [value, setValue] =
    useState("");

  const [
    selectedAccountId,
    setSelectedAccountId,
  ] = useState("");

  const [category, setCategory] =
    useState("");

  const [categories, setCategories] =
    useState<FinanceCategory[]>([]);
  const [categoryGroupId, setCategoryGroupId] =
    useState("");

  const [
    showCategoriesModal,
    setShowCategoriesModal,
  ] = useState(false);

  const [
    showAddCategoryModal,
    setShowAddCategoryModal,
  ] = useState(false);

  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState("");

  const [
    isSavingCategory,
    setIsSavingCategory,
  ] = useState(false);

  const [
    editingCategory,
    setEditingCategory,
  ] = useState<FinanceCategory | null>(null);

  const [
    editingCategoryName,
    setEditingCategoryName,
  ] = useState("");

  const [
    isEditingCategory,
    setIsEditingCategory,
  ] = useState(false);

  const [
    categoryToDelete,
    setCategoryToDelete,
  ] = useState<FinanceCategory | null>(null);

  const [
    isDeletingCategory,
    setIsDeletingCategory,
  ] = useState(false);

  const [note, setNote] =
    useState("");
  const [installments, setInstallments] =
    useState("1");

  const [date, setDate] =
    useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const isSavingRef =
    useRef(false);

  const variableAccounts =
    useMemo(() => {
      return accounts.filter(
        (acc) =>
          acc.type === "VARIABLE"
      );
    }, [accounts]);

  const selectedAccount =
    useMemo(() => {
      return accounts.find(
        (acc) =>
          acc.id ===
          selectedAccountId
      );
    }, [
      accounts,
      selectedAccountId,
    ]);

  const isCreditCardSelected =
    isCreditCardAccount(selectedAccount);
  const isPixSelected = isPixAccount(selectedAccount);
  const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    setValue("");
    setNote("");
    setInstallments("1");
    setDate(
      getTodayDateKey()
    );
    setCategory("");
    setCategoryGroupId("");
    setShowCategoriesModal(false);
    setShowAddCategoryModal(false);
    setNewCategoryName("");
    setIsSavingCategory(false);
    setEditingCategory(null);
    setEditingCategoryName("");
    setIsEditingCategory(false);
    setCategoryToDelete(null);
    setIsDeletingCategory(false);
    setIsSaving(false);

    isSavingRef.current = false;

    const primaryCreditCard =
      variableAccounts.find(
        (acc) =>
          isCreditCardAccount(acc) &&
          acc.isPrimaryCreditCard === true &&
          acc.isArchived !== true
      );

    const creditCard =
      variableAccounts.find(
        (acc) =>
          isCreditCardAccount(acc) &&
          acc.isArchived !== true
      );

    const defaultAccount =
      primaryCreditCard ||
      creditCard ||
      variableAccounts[0];

    if (defaultAccount) {
      setSelectedAccountId(
        defaultAccount.id
      );
    } else {
      setSelectedAccountId("");
    }

    const loadCategories = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        const profile = await ensureUserProfile(currentUser);
        if (isMounted) {
          setCategoryGroupId(profile.groupId);
        }

        const groupCategories = await seedDefaultCategoriesForGroup(
          profile.groupId,
          {
            preset: getCategorySeedPreset(profile.email),
          }
        );

        if (isMounted) {
          setCategories(groupCategories);
        }
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);

        if (isMounted) {
          setCategories([]);
          toast.error("Nao foi possivel carregar as categorias.");
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [open, variableAccounts]);

  if (!open) return null;

  const openAddCategory = () => {
    setNewCategoryName("");
    setShowAddCategoryModal(true);
  };

  const closeAddCategory = () => {
    if (isSavingCategory) return;

    setNewCategoryName("");
    setShowAddCategoryModal(false);
  };

  const saveCategory = async () => {
    const trimmedName = newCategoryName.trim();

    if (!categoryGroupId || !trimmedName) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    setIsSavingCategory(true);

    try {
      const nextOrder =
        categories.length > 0
          ? Math.max(
              ...categories.map((item, index) =>
                Number.isFinite(Number(item.order)) ? Number(item.order) : index
              )
            ) + 1
          : 0;

      const newCategory = await createCategory(
        categoryGroupId,
        trimmedName,
        nextOrder
      );

      const updatedCategories = [...categories, newCategory].sort((a, b) => {
        const orderDiff = Number(a.order || 0) - Number(b.order || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });

      setCategories(updatedCategories);
      setCategory(newCategory.name);
      setNewCategoryName("");
      setShowAddCategoryModal(false);
      toast.success("Categoria cadastrada com sucesso.");
    } catch (error) {
      console.error("Erro ao cadastrar categoria:", error);
      toast.error("Nao foi possivel cadastrar a categoria.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const openEditCategory = (item: FinanceCategory) => {
    setEditingCategory(item);
    setEditingCategoryName(item.name);
  };

  const closeEditCategory = () => {
    if (isEditingCategory) return;

    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const saveCategoryName = async () => {
    if (!editingCategory) return;

    const trimmedName = editingCategoryName.trim();

    if (!trimmedName) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    setIsEditingCategory(true);

    try {
      const nextName = await updateCategoryName(editingCategory.id, trimmedName);

      setCategories((prev) =>
        prev.map((item) =>
          item.id === editingCategory.id ? { ...item, name: nextName } : item
        )
      );

      if (category === editingCategory.name) {
        setCategory(nextName);
      }

      setEditingCategory(null);
      setEditingCategoryName("");
      toast.success("Categoria editada com sucesso.");
    } catch (error) {
      console.error("Erro ao editar categoria:", error);
      toast.error("Nao foi possivel editar a categoria.");
    } finally {
      setIsEditingCategory(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeletingCategory(true);

    try {
      await deleteCategory(categoryToDelete.id);

      setCategories((prev) =>
        prev.filter((item) => item.id !== categoryToDelete.id)
      );

      if (category === categoryToDelete.name) {
        setCategory("");
      }

      setCategoryToDelete(null);
      toast.success("Categoria excluida com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      toast.error("Nao foi possivel excluir a categoria.");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const getOrCreateCreditCardForMonth = async (
    targetMonthId: string,
    selected: FinanceAccount
  ) => {
    const targetAccounts =
      targetMonthId === monthId
        ? accounts
        : ((await getAccountsByMonth(targetMonthId)) as FinanceAccount[]);

    const existingCard = targetAccounts.find((acc) =>
      matchesSelectedCreditCard(acc, selected)
    );

    if (existingCard) return existingCard;

    const sameTypeAccounts = targetAccounts.filter(
      (acc) => acc.type === selected.type
    );

    const nextOrder =
      sameTypeAccounts.length > 0
        ? Math.max(
            ...sameTypeAccounts.map((acc, index) =>
              Number.isFinite(Number(acc.order)) ? Number(acc.order) : index
            )
          ) + 1
        : 0;

    return createAccount(targetMonthId, {
      name: selected.name,
      type: selected.type,
      value: 0,
      dia_vencimento: selected.dia_vencimento,
      dia_fechamento: getCreditCardClosingDay(selected),
      isCreditCard: true,
      creditCardKey: getCreditCardKey(selected),
      isPrimaryCreditCard: selected.isPrimaryCreditCard === true,
      isPaid: false,
      order: nextOrder,
    });
  };

  const handleSave =
    async () => {
      if (
        isSavingRef.current
      )
        return;

      if (
        !monthId ||
        !auth.currentUser
      )
        return;

      const parsedValue =
        parseCurrency(value);
      const parsedInstallments = isCreditCardSelected
        ? Number(installments || 1)
        : 1;

      if (!parsedValue) {
        toast.error(
          "Informe o valor do lançamento."
        );

        return;
      }

      if (
        isCreditCardSelected &&
        (!Number.isInteger(parsedInstallments) ||
          parsedInstallments < 1 ||
          parsedInstallments > 12)
      ) {
        toast.error("Selecione o numero de parcelas.");
        return;
      }

      const selected =
        accounts.find(
          (acc) =>
            acc.id ===
            selectedAccountId
        );

      if (!selected) {
        toast.error(
          "Selecione uma conta."
        );

        return;
      }

      if (
        (isCreditCardSelected || isPixSelected) &&
        !category
      ) {
        toast.error(
          "Selecione uma categoria."
        );

        return;
      }

      const launcherName =
        resolveLauncherName();

      const launchDate =
        date;

      if (!launchDate) {
        toast.error(
          "Informe a data do lançamento."
        );

        return;
      }

      isSavingRef.current = true;

      setIsSaving(true);

      let targetMonthId =
        monthId;

      let targetAccount =
        selected;

      let shouldRefreshMonths =
        false;

      try {
        const profile = await ensureUserProfile(
          auth.currentUser
        );

        if (isCreditCardSelected && parsedInstallments > 1) {
          if (selected.isArchived === true) {
            toast.error(
              "Este cartão está arquivado e não será lançado em faturas futuras."
            );
            return;
          }

          const firstInvoiceMonth = getInvoiceMonth(
            launchDate,
            getCreditCardClosingDay(selected)
          );
          const installmentGroupId = getInstallmentGroupId();
          const installmentValues = splitCurrencyInCents(
            parsedValue,
            parsedInstallments
          );
          let months = (await getAllMonths(profile.groupId)) as MonthDoc[];
          let firstTargetMonth = months.find(
            (item) =>
              item.year === firstInvoiceMonth.year &&
              item.month === firstInvoiceMonth.month
          );

          if (!firstTargetMonth) {
            const createdMonthId = await createMonth(
              firstInvoiceMonth.year,
              firstInvoiceMonth.month,
              auth.currentUser.uid,
              profile.groupId
            );

            firstTargetMonth = {
              id: createdMonthId,
              year: firstInvoiceMonth.year,
              month: firstInvoiceMonth.month,
            };
            months = [...months, firstTargetMonth];
            shouldRefreshMonths = true;
          }

          const installmentAccount = await getOrCreateCreditCardForMonth(
            firstTargetMonth.id,
            selected
          );
          const firstInstallmentNote = note.trim()
            ? `${note.trim()} (1/${parsedInstallments})`
            : `Parcela 1/${parsedInstallments}`;
          const userName =
            auth.currentUser.displayName || auth.currentUser.email || "";

          await addTransaction(firstTargetMonth.id, {
            value: installmentValues[0] / 100,
            accountId: installmentAccount.id,
            category,
            note: firstInstallmentNote,
            userId: auth.currentUser.uid,
            userName,
            launcherId: auth.currentUser.uid,
            launcherName,
            date: launchDate,
            installmentGroupId,
            installmentCurrent: 1,
            installmentTotal: parsedInstallments,
          });

          for (let index = 1; index < parsedInstallments; index += 1) {
            const invoiceMonth = addMonthsToInvoice(firstInvoiceMonth, index);
            const existingFutureMonth = months.find(
              (item) =>
                item.year === invoiceMonth.year &&
                item.month === invoiceMonth.month
            );

            if (!existingFutureMonth) continue;

            const futureInstallmentAccount =
              await getOrCreateCreditCardForMonth(
                existingFutureMonth.id,
                selected
              );
            const installmentCurrent = index + 1;
            const installmentNote = note.trim()
              ? `${note.trim()} (${installmentCurrent}/${parsedInstallments})`
              : `Parcela ${installmentCurrent}/${parsedInstallments}`;

            await addTransaction(existingFutureMonth.id, {
              value: installmentValues[index] / 100,
              accountId: futureInstallmentAccount.id,
              category,
              note: installmentNote,
              userId: auth.currentUser.uid,
              userName,
              launcherId: auth.currentUser.uid,
              launcherName,
              date: launchDate,
              installmentGroupId,
              installmentCurrent,
              installmentTotal: parsedInstallments,
            });
          }

          const nextInvoiceMonth = addMonthsToInvoice(firstInvoiceMonth, 1);

          await createInstallmentPurchase({
            groupId: profile.groupId,
            creditCardKey: getCreditCardKey(selected),
            cardName: selected.name,
            dia_vencimento: selected.dia_vencimento,
            dia_fechamento: getCreditCardClosingDay(selected),
            category,
            note,
            purchaseDate: launchDate,
            firstYear: nextInvoiceMonth.year,
            firstMonth: nextInvoiceMonth.month,
            firstInstallmentNumber: 2,
            totalPurchaseInstallments: parsedInstallments,
            installmentValuesCents: installmentValues.slice(1),
            userId: auth.currentUser.uid,
            userName,
            launcherId: auth.currentUser.uid,
            launcherName,
            installmentGroupId,
          });

          if (shouldRefreshMonths || firstTargetMonth.id !== monthId) {
            await onMonthsChanged?.(firstTargetMonth.id);
          }

          const trans =
            (await getTransactions(monthId)) as TransactionRecord[];

          setTransactions(trans);
          await onSaved?.(firstTargetMonth.id);

          setValue("");
          setCategory("");
          setNote("");
          setInstallments("1");
          setDate(getTodayDateKey());
          onClose();

          toast.success("Lançamento parcelado feito com sucesso.");
          return;
        }

        if (
          isCreditCardSelected ||
          isPixSelected
        ) {
          const invoiceMonth =
            getInvoiceMonth(
              launchDate,
              isPixSelected
                ? getAccountClosingDay(selected)
                : getCreditCardClosingDay(selected)
            );

          const months =
            (await getAllMonths(
              profile.groupId
            )) as MonthDoc[];

          const existingMonth =
            months.find(
              (month) =>
                month.year ===
                  invoiceMonth.year &&
                month.month ===
                  invoiceMonth.month
            );

          if (existingMonth) {
            targetMonthId =
              existingMonth.id;
          } else {
            targetMonthId =
              await createMonth(
                invoiceMonth.year,
                invoiceMonth.month,
                auth.currentUser
                  .uid,
                profile.groupId
              );

            shouldRefreshMonths =
              true;
          }

          if (
            targetMonthId !==
            monthId
          ) {
            if (isCreditCardSelected && selected.isArchived === true) {
              toast.error(
                "Este cartão está arquivado e não será lançado em faturas futuras."
              );
              return;
            }

            const targetAccounts =
              (await getAccountsByMonth(
                targetMonthId
              )) as FinanceAccount[];

            let targetClosingAccount = isPixSelected
              ? targetAccounts.find((acc) => isPixAccount(acc))
              : targetAccounts.find((acc) => matchesSelectedCreditCard(acc, selected));

            if (!targetClosingAccount) {
              const sameTypeAccounts = targetAccounts.filter(
                (acc) => acc.type === selected.type
              );

              const nextOrder =
                sameTypeAccounts.length > 0
                  ? Math.max(
                      ...sameTypeAccounts.map((acc, index) =>
                        Number.isFinite(Number(acc.order))
                          ? Number(acc.order)
                          : index
                      )
                    ) + 1
                  : 0;

              targetClosingAccount = await createAccount(targetMonthId, {
                name: selected.name,
                type: selected.type,
                value: 0,
                ...(isPixSelected
                  ? {}
                  : { dia_vencimento: selected.dia_vencimento }),
                dia_fechamento: isPixSelected
                  ? getAccountClosingDay(selected)
                  : getCreditCardClosingDay(selected),
                ...(isPixSelected
                  ? {}
                  : {
                      isCreditCard: true,
                      creditCardKey: getCreditCardKey(selected),
                      isPrimaryCreditCard:
                        selected.isPrimaryCreditCard === true,
                    }),
                isPaid: false,
                order: nextOrder,
              });
            }

            targetAccount =
              targetClosingAccount;
          }
        }

        const payload = {
          value: parsedValue,

          accountId:
            targetAccount.id,

          category:
            isCreditCardSelected || isPixSelected
              ? category
              : "",

          note,

          userId:
            auth.currentUser
              .uid,

          userName:
            auth.currentUser
              .displayName ||
            auth.currentUser
              .email ||
            "",

          launcherId:
            auth.currentUser
              .uid,

          launcherName,

          date: launchDate,
        };

        await addTransaction(
          targetMonthId,
          payload
        );

        if (
          shouldRefreshMonths ||
          targetMonthId !==
            monthId
        ) {
          await onMonthsChanged?.(
            targetMonthId
          );
        }

        if (
          !isCreditCardAccount(selected)
        ) {
          const newValue =
            Number(
              targetAccount.value ||
                0
            ) + parsedValue;

          await updateAccountValue(
            targetMonthId,
            targetAccount.id,
            newValue
          );

          if (targetMonthId === monthId) {
            setAccounts(
              (prev) =>
                prev.map(
                  (acc) =>
                    acc.id ===
                    selected.id
                      ? {
                          ...acc,
                          value:
                            newValue,
                        }
                      : acc
                )
            );
          }
        }

        const trans =
          (await getTransactions(
            monthId
          )) as TransactionRecord[];

        setTransactions(
          trans
        );

        await onSaved?.(
          targetMonthId
        );

        setValue("");
        setCategory("");
        setNote("");
        setInstallments("1");

        setDate(
          getTodayDateKey()
        );

        onClose();

        toast.success(
          "Lançamento feito com sucesso."
        );
      } catch (error) {
        console.error(error);

        toast.error(
          "Não foi possível salvar o lançamento."
        );
      } finally {
        isSavingRef.current =
          false;

        setIsSaving(false);
      }
    };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

      <form
        className="bg-zinc-900 p-6 rounded-xl w-80 space-y-3 border border-zinc-800"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >

        <h2 className="text-lg font-bold">
          Novo Lançamento
        </h2>

        {/* 🔥 VALOR */}
        <label className="block">
          <span className={fieldLabelClass}>Valor</span>
          <input
            type="tel"
            inputMode="decimal"
            value={value}
            onChange={(e) =>
              setValue(
                formatCurrencyInput(
                  e.target.value
                )
              )
            }
            placeholder="Valor"
            required
            disabled={isSaving}
            className="w-full p-2 bg-zinc-800 rounded"
          />
        </label>

        {/* 🔥 CONTA */}
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className={fieldLabelClass}>Conta</span>
            <select
              value={
                selectedAccountId
              }
              onChange={(e) => {
                const nextId =
                  e.target.value;

                setSelectedAccountId(
                  nextId
                );

                const nextAccount =
                  accounts.find(
                    (acc) =>
                      acc.id ===
                      nextId
                  );

                if (!isCreditCardAccount(nextAccount) && !isPixAccount(nextAccount)) {
                  setCategory("");
                  setInstallments("1");
                }
              }}
              required
              disabled={isSaving}
              className="w-full p-2 bg-zinc-800 rounded"
            >
              <option value="">
                Selecione a conta
              </option>

              {variableAccounts.map(
                (acc) => (
                  <option
                    key={acc.id}
                    value={acc.id}
                  >
                    {acc.name}
                  </option>
                )
              )}
            </select>
          </label>

          {isCreditCardSelected && (
            <label className="w-20 shrink-0">
              <span className={fieldLabelClass}>Parcelas</span>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                disabled={isSaving}
                className="w-full p-2 bg-zinc-800 rounded"
                aria-label="Parcelas"
                title="Parcelas"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}x
                    </option>
                  )
                )}
              </select>
            </label>
          )}
        </div>

        {/* 🔥 CATEGORIA */}
        {(isCreditCardSelected || isPixSelected) && (
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className={fieldLabelClass}>Categoria</span>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
                required
                disabled={isSaving}
                className="w-full p-2 bg-zinc-800 rounded"
              >
                <option value="">
                  Selecione a categoria
                </option>

                {categories.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.name}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={() =>
                setShowCategoriesModal(true)
              }
              disabled={isSaving}
              className="shrink-0 bg-zinc-800 hover:bg-zinc-700 p-2 rounded transition disabled:opacity-60 disabled:cursor-not-allowed"
              title="Ver categorias"
              aria-label="Ver categorias"
            >
              <Pencil size={18} />
            </button>
          </div>
        )}

        {/* 🔥 OBS */}
        <label className="block">
          <span className={fieldLabelClass}>Observação</span>
          <input
            value={note}
            onChange={(e) =>
              setNote(
                e.target.value
              )
            }
            placeholder="Observação"
            disabled={isSaving}
            className="w-full p-2 bg-zinc-800 rounded"
          />
        </label>

        {/* 🔥 DATA */}
        <label className="block">
          <span className={fieldLabelClass}>Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) =>
              setDate(
                e.target.value
              )
            }
            required
            disabled={isSaving}
            className="w-full p-2 bg-zinc-800 rounded"
          />
        </label>

        {/* 🔥 BOTÕES */}
        <div className="flex justify-between pt-2">

          <button
            disabled={
              isSaving
            }
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
          >
            {isSaving
              ? "Salvando..."
              : "Salvar"}
          </button>

          <button
            onClick={() => {
              if (
                isSavingRef.current
              )
                return;

              setValue("");
              setCategory("");
              setNote("");

              setDate(
                getTodayDateKey()
              );

              onClose();
            }}
            disabled={
              isSaving
            }
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
          >
            Cancelar
          </button>

        </div>
      </form>

      {showCategoriesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold">
                Categorias
              </h2>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openAddCategory}
                  className="bg-purple-600 hover:bg-purple-700 p-2 rounded transition"
                  title="Cadastrar categoria"
                  aria-label="Cadastrar categoria"
                >
                  <Plus size={18} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowCategoriesModal(false)
                  }
                  className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition"
                >
                  Fechar
                </button>
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="text-zinc-400">
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              <div className="category-scroll max-h-[55vh] overflow-y-auto space-y-2 pr-2">
                {categories.map((item) => (
                  <div
                    key={item.id}
                    className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-medium break-words">
                        {item.name}
                      </span>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCategory(item)}
                          className="p-1 text-zinc-400 hover:text-zinc-100 transition"
                          title="Editar categoria"
                          aria-label={`Editar categoria ${item.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoryToDelete(item)}
                          className="p-1 text-zinc-500 hover:text-red-300 transition"
                          title="Excluir categoria"
                          aria-label={`Excluir categoria ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] px-4">
          <form
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveCategory();
            }}
          >
            <h2 className="text-lg font-bold mb-4">
              Nova categoria
            </h2>

            <label className="block mb-4">
              <span className={fieldLabelClass}>Nome da categoria</span>
              <input
                value={newCategoryName}
                onChange={(event) =>
                  setNewCategoryName(event.target.value)
                }
                placeholder="Nome da categoria"
                disabled={isSavingCategory}
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none"
                autoFocus
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingCategory}
                type="submit"
              >
                {isSavingCategory ? "Salvando..." : "Salvar"}
              </button>

              <button
                onClick={closeAddCategory}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingCategory}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] px-4">
          <form
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6"
            onSubmit={(event) => {
              event.preventDefault();
              saveCategoryName();
            }}
          >
            <h2 className="text-lg font-bold mb-4">
              Editar categoria
            </h2>

            <label className="block mb-4">
              <span className={fieldLabelClass}>Nome da categoria</span>
              <input
                value={editingCategoryName}
                onChange={(event) =>
                  setEditingCategoryName(event.target.value)
                }
                placeholder="Nome da categoria"
                disabled={isEditingCategory}
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none"
                autoFocus
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isEditingCategory}
                type="submit"
              >
                {isEditingCategory ? "Salvando..." : "Salvar"}
              </button>

              <button
                onClick={closeEditCategory}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isEditingCategory}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-2">
              Excluir categoria
            </h2>

            <p className="text-sm text-zinc-400">
              Deseja realmente excluir {categoryToDelete.name}?
            </p>

            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={confirmDeleteCategory}
                disabled={isDeletingCategory}
                type="button"
                autoFocus
              >
                {isDeletingCategory ? "Excluindo..." : "Excluir"}
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => {
                  if (isDeletingCategory) return;
                  setCategoryToDelete(null);
                }}
                disabled={isDeletingCategory}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
