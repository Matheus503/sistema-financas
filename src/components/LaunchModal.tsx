"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { auth } from "../lib/auth";
import {
  addTransaction,
  getTransactions,
} from "../services/transactionService";

import {
  getAccountsByMonth,
  updateAccountValue,
} from "../services/accountService";

import type { FinanceAccount } from "../services/accountService";

import {
  createMonth,
  getAllMonths,
} from "../services/monthService";

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
};

const nubankCategories = [
  "Alimentação",
  "Roles",
  "Farmácia",
  "Casa",
  "Supermercado",
  "Uber e etc",
  "Cabeleireiro",
  "Gastos Carro",
  "Pedágios",
  "Gastos Matheus",
  "Gastos Giovana",
  "Academia",
  "Doações",
  "Descontos Antecipação Nu",
];

const resolveLauncherName = () => {
  const raw = `${
    auth.currentUser?.displayName || ""
  } ${
    auth.currentUser?.email || ""
  }`.toLowerCase();

  if (raw.includes("matheus"))
    return "Matheus";

  if (raw.includes("giovana"))
    return "Giovana";

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

const getInvoiceMonth = (
  dateKey: string
) => {
  const [year, month, day] =
    dateKey
      .split("-")
      .map(Number);

  if (day >= 12) {
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
}: Props) {
  const [value, setValue] =
    useState("");

  const [
    selectedAccountId,
    setSelectedAccountId,
  ] = useState("");

  const [category, setCategory] =
    useState("");

  const [note, setNote] =
    useState("");

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

  const isNubankSelected =
    Boolean(
      selectedAccount?.name?.includes(
        "Nubank"
      )
    );

  useEffect(() => {
    if (!open) return;

    setValue("");
    setNote("");
    setDate(
      getTodayDateKey()
    );
    setCategory("");
    setIsSaving(false);

    isSavingRef.current = false;

    const nubank =
      variableAccounts.find(
        (acc) =>
          acc.name?.includes(
            "Nubank"
          )
      );

    const defaultAccount =
      nubank ||
      variableAccounts[0];

    if (defaultAccount) {
      setSelectedAccountId(
        defaultAccount.id
      );
    } else {
      setSelectedAccountId("");
    }
  }, [open, variableAccounts]);

  if (!open) return null;

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

      if (!parsedValue) {
        toast.error(
          "Informe o valor do lançamento."
        );

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
        isNubankSelected &&
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
        if (
          isNubankSelected
        ) {
          const invoiceMonth =
            getInvoiceMonth(
              launchDate
            );

          const months =
            (await getAllMonths()) as MonthDoc[];

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
                  .uid
              );

            shouldRefreshMonths =
              true;
          }

          if (
            targetMonthId !==
            monthId
          ) {
            const targetAccounts =
              (await getAccountsByMonth(
                targetMonthId
              )) as FinanceAccount[];

            const targetNubank =
              targetAccounts.find(
                (acc) =>
                  acc.name?.includes(
                    "Nubank"
                  )
              );

            if (
              !targetNubank
            )
              return;

            targetAccount =
              targetNubank;
          }
        }

        const payload = {
          value: parsedValue,

          accountId:
            targetAccount.id,

          category:
            isNubankSelected
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
          !selected.name?.includes(
            "Nubank"
          )
        ) {
          const newValue =
            Number(
              selected.value ||
                0
            ) + parsedValue;

          await updateAccountValue(
            monthId,
            selected.id,
            newValue
          );

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

        const trans =
          (await getTransactions(
            monthId
          )) as TransactionRecord[];

        setTransactions(
          trans
        );

        setValue("");
        setCategory("");
        setNote("");

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

      <div className="bg-zinc-900 p-6 rounded-xl w-80 space-y-3 border border-zinc-800">

        <h2 className="text-lg font-bold">
          Novo Lançamento
        </h2>

        {/* 🔥 VALOR */}
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

        {/* 🔥 CONTA */}
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

            if (
              !nextAccount?.name?.includes(
                "Nubank"
              )
            ) {
              setCategory("");
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

        {/* 🔥 CATEGORIA */}
        {isNubankSelected && (
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

            {nubankCategories.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>
        )}

        {/* 🔥 OBS */}
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

        {/* 🔥 DATA */}
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

        {/* 🔥 BOTÕES */}
        <div className="flex justify-between pt-2">

          <button
            onClick={
              handleSave
            }
            disabled={
              isSaving
            }
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
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
      </div>
    </div>
  );
}
