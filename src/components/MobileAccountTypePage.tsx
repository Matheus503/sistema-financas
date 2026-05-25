"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { auth } from "../lib/auth";
import { getAllMonths } from "../services/monthService";
import {
  deleteAccount,
  formatAccountNameWithDueDay,
  getAccountsByMonth,
  toggleAccountPaid,
  updateAccountValue,
} from "../services/accountService";
import type { FinanceAccount } from "../services/accountService";
import { getTransactions } from "../services/transactionService";
import CreateAccountModal from "./CreateAccountModal";
import EditAccountModal from "./EditAccountModal";

type Props = {
  accountType: "CREDIT" | "FIXED" | "VARIABLE";
  title: string;
  totalLabel: string;
  emptyLabel: string;
  deleteTitle: string;
  deletedMessage: string;
};

const monthName = (month: number) =>
  [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ][month - 1];

const isMatheus = () => {
  const raw = `${auth.currentUser?.displayName || ""} ${
    auth.currentUser?.email || ""
  }`.toLowerCase();

  return raw.includes("matheus");
};

export default function MobileAccountTypePage({
  accountType,
  title,
  totalLabel,
  emptyLabel,
  deleteTitle,
  deletedMessage,
}: Props) {
  const router = useRouter();

  const [months, setMonths] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [monthId, setMonthId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showValues, setShowValues] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<FinanceAccount | null>(null);
  const [editValue, setEditValue] = useState("");
  const [detailsAccount, setDetailsAccount] = useState<FinanceAccount | null>(
    null
  );
  const [accountToDelete, setAccountToDelete] =
    useState<FinanceAccount | null>(null);

  const formatMoney = (value: number) => {
    if (!showValues) return "R$ ••••••";

    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const parseCurrency = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatCurrencyInput = (value: number) =>
    Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatCurrencyTyping = (nextValue: string) => {
    const numbers = nextValue.replace(/\D/g, "");
    const amount = Number(numbers) / 100;

    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const loadData = async (targetMonthId: string) => {
    const [accs, trans] = await Promise.all([
      getAccountsByMonth(targetMonthId),
      getTransactions(targetMonthId),
    ]);

    setAccounts(accs as FinanceAccount[]);
    setTransactions(trans);
  };

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.push("/");
        return;
      }

      if (!isMatheus()) {
        router.push("/mobile");
        return;
      }

      const all = await getAllMonths();
      if (!all || all.length === 0) return;

      const lastIndex = all.length - 1;
      setMonths(all);
      setCurrentIndex(lastIndex);
      setMonthId(all[lastIndex].id);
      await loadData(all[lastIndex].id);
    };

    load();
  }, [router]);

  const currentMonth = months[currentIndex] || null;

  const getAccountValue = (account: FinanceAccount) => {
    const baseValue = Number(account.value || 0);

    const totalTransactions = transactions
      .filter((transaction) => transaction.accountId === account.id)
      .reduce(
        (sum, transaction) => sum + Number(transaction.value || 0),
        0
      );

    return baseValue + totalTransactions;
  };

  const visibleAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.type === accountType)
      .sort((a, b) => {
        const aDueDay = Number(a.dia_vencimento || 999);
        const bDueDay = Number(b.dia_vencimento || 999);
        if (aDueDay !== bDueDay) return aDueDay - bDueDay;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [accounts, accountType]);

  const totalAmount = visibleAccounts.reduce(
    (sum, account) => sum + getAccountValue(account),
    0
  );

  const goPrev = async () => {
    if (currentIndex <= 0) return;

    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    setMonthId(months[nextIndex].id);
    await loadData(months[nextIndex].id);
  };

  const goNext = async () => {
    if (currentIndex >= months.length - 1) return;

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setMonthId(months[nextIndex].id);
    await loadData(months[nextIndex].id);
  };

  const handleTogglePaid = async (account: FinanceAccount) => {
    if (!monthId) return;

    await toggleAccountPaid(monthId, account.id, !!account.isPaid);

    setAccounts((prev) =>
      prev.map((item) =>
        item.id === account.id ? { ...item, isPaid: !item.isPaid } : item
      )
    );
  };

  const openEdit = (account: FinanceAccount) => {
    setEditAccount(account);
    setEditValue(formatCurrencyInput(getAccountValue(account)));
  };

  const saveEdit = async () => {
    if (!monthId || !editAccount) return;

    const parsed = parseCurrency(editValue);

    await updateAccountValue(monthId, editAccount.id, parsed);

    setAccounts((prev) =>
      prev.map((account) =>
        account.id === editAccount.id ? { ...account, value: parsed } : account
      )
    );

    setEditAccount(null);
    setEditValue("");
    toast.success("Valor editado com sucesso.");
  };

  const confirmDelete = async () => {
    if (!monthId || !accountToDelete) return;

    await deleteAccount(monthId, accountToDelete.id);

    setAccounts((prev) =>
      prev.filter((account) => account.id !== accountToDelete.id)
    );
    setAccountToDelete(null);
    toast.success(deletedMessage);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-4 py-6 flex flex-col gap-5">
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => router.push("/mobile")}
          type="button"
          aria-label="Voltar"
          className="absolute left-0 rounded-full bg-zinc-900 p-2 text-zinc-200 border border-zinc-800"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-4 bg-zinc-900 px-5 py-2 rounded-full">
          <button onClick={goPrev} type="button">
            ←
          </button>

          <span>
            {currentMonth
              ? `${monthName(currentMonth.month)} ${currentMonth.year}`
              : ""}
          </span>

          <button onClick={goNext} type="button">
            →
          </button>
        </div>
      </div>

      <div className="bg-purple-600 px-4 py-3 rounded-2xl">
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80">{totalLabel}</p>

          <button
            onClick={() => setShowValues((prev) => !prev)}
            type="button"
            aria-label="Mostrar ou ocultar valores"
          >
            {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <h1 className="text-2xl font-bold mt-1">{formatMoney(totalAmount)}</h1>
      </div>

      <div className="bg-zinc-900 p-4 rounded-2xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-zinc-400">{title}</p>

          <button
            onClick={() => setShowCreate(true)}
            type="button"
            className="bg-purple-600 w-8 h-8 rounded-full text-xl leading-none"
          >
            +
          </button>
        </div>

        {visibleAccounts.length === 0 && (
          <p className="text-zinc-500 text-sm">{emptyLabel}</p>
        )}

        <div className="max-h-[62vh] overflow-y-auto pr-1 flex flex-col gap-2">
          {visibleAccounts.map((account) => (
            <div
              key={account.id}
              onClick={() => handleTogglePaid(account)}
              className={`rounded-xl border p-2.5 cursor-pointer ${
                account.isPaid
                  ? "bg-green-500/15 border-l-4 border-l-green-400 border-green-400/25"
                  : "bg-red-500/15 border-l-4 border-l-red-400 border-red-400/25"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-sm font-medium">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setDetailsAccount(account);
                  }}
                  type="button"
                  className="min-w-0 text-left font-semibold"
                >
                  {formatAccountNameWithDueDay(account)}
                </button>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(account);
                    }}
                    type="button"
                    className="font-semibold text-red-400"
                  >
                    {formatMoney(getAccountValue(account))}
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setAccountToDelete(account);
                    }}
                    type="button"
                    className="p-1"
                    aria-label={`Excluir ${title}`}
                  >
                    <Trash2 size={16} className="text-zinc-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Editar valor</h2>

            <input
              type="tel"
              inputMode="decimal"
              value={editValue}
              onChange={(event) =>
                setEditValue(formatCurrencyTyping(event.target.value))
              }
              className="w-full bg-zinc-800 rounded-xl p-3 outline-none"
            />

            <div className="flex gap-2 mt-4">
              <button
                className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition"
                onClick={saveEdit}
                type="button"
              >
                Salvar
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
                onClick={() => {
                  setEditAccount(null);
                  setEditValue("");
                }}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {accountToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">{deleteTitle}</h2>

            <p className="text-sm text-zinc-400">
              Deseja realmente excluir {accountToDelete.name}?
            </p>

            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
                onClick={confirmDelete}
                type="button"
              >
                Excluir
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
                onClick={() => setAccountToDelete(null)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        monthId={monthId}
        type={accountType}
        accounts={accounts}
        setAccounts={setAccounts}
      />

      <EditAccountModal
        open={Boolean(detailsAccount)}
        onClose={() => setDetailsAccount(null)}
        monthId={monthId}
        account={detailsAccount}
        setAccounts={setAccounts}
      />
    </div>
  );
}
