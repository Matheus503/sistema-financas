"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Menu,
  Trash2,
  X,
} from "lucide-react";

import { auth } from "../../lib/auth";
import { getAllMonths } from "../../services/monthService";

import {
  getTransactions,
  updateTransaction,
  deleteTransaction,
} from "../../services/transactionService";

import {
  formatAccountNameWithDueDay,
  getAccountsByMonth,
  isNubankCreditCardAccount,
} from "../../services/accountService";

import type { FinanceAccount } from "../../services/accountService";

import LaunchModal from "../../components/LaunchModal";
import EditAccountModal from "../../components/EditAccountModal";

type LauncherFilter =
  | "matheus"
  | "giovana"
  | "all";

export default function MobileDashboard() {
  const router = useRouter();

  const [months, setMonths] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [monthId, setMonthId] =
    useState<string | null>(null);

  const [transactions, setTransactions] =
    useState<any[]>([]);

  const [accounts, setAccounts] =
    useState<any[]>([]);

  const [detailsAccount, setDetailsAccount] =
    useState<FinanceAccount | null>(null);

  const [openModal, setOpenModal] =
    useState(false);

  const [isSideMenuOpen, setIsSideMenuOpen] =
    useState(false);

  const [
    showAccountMenu,
    setShowAccountMenu,
  ] = useState(false);

  const [showValues, setShowValues] =
    useState(false);

  const [launcherFilter, setLauncherFilter] =
    useState<LauncherFilter>("matheus");

  // 🔥 edição rápida
  const [editTransaction, setEditTransaction] =
    useState<any | null>(null);

  const [editValue, setEditValue] =
    useState("");

  // 🔥 exclusão
  const [
    deleteTransactionData,
    setDeleteTransactionData,
  ] = useState<any | null>(null);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const renderValue = (value: number) =>
    showValues
      ? formatMoney(value)
      : "••••••";

  const formatDate = (date: string) => {
    if (!date) return "";

    const dateKey = String(date).slice(
      0,
      10
    );

    const match = dateKey.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (match) {
      return `${match[3]}/${match[2]}`;
    }

    const d = new Date(date);

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const monthName = (m: number) =>
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
    ][m - 1];

  const getLauncherName = (
    transaction: any
  ) => {
    const raw =
      transaction.launcherName ||
      transaction.userName ||
      "";

    if (!raw) return "";

    const normalized =
      String(raw).toLowerCase();

    if (
      normalized.includes("matheus")
    )
      return "Matheus";

    if (
      normalized.includes("giovana")
    )
      return "Giovana";

    return String(raw)
      .split("@")[0]
      .split(" ")[0];
  };

  const getCurrentUserFilter = () => {
    const raw = `${
      auth.currentUser?.displayName ||
      ""
    } ${
      auth.currentUser?.email || ""
    }`.toLowerCase();

    if (raw.includes("giovana"))
      return "giovana";

    return "matheus";
  };

  const isCurrentUserMatheus = () => {
    const raw = `${
      auth.currentUser?.displayName ||
      ""
    } ${
      auth.currentUser?.email || ""
    }`.toLowerCase();

    return raw.includes("matheus");
  };

  // 🔥 máscara monetária
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

  // 🔹 carregar meses
  useEffect(() => {
    const load = async () => {
      const user =
        auth.currentUser;

      if (!user) {
        router.push("/");
        return;
      }

      setLauncherFilter(
        getCurrentUserFilter()
      );

      setShowAccountMenu(
        isCurrentUserMatheus()
      );

      const all =
        await getAllMonths();

      if (
        !all ||
        all.length === 0
      )
        return;

      setMonths(all);

      const lastIndex =
        all.length - 1;

      setCurrentIndex(lastIndex);

      setMonthId(
        all[lastIndex].id
      );
    };

    load();
  }, [router]);

  // 🔹 carregar dados
  useEffect(() => {
    const loadData = async () => {
      if (!monthId) return;

      const [trans, accs] =
        await Promise.all([
          getTransactions(monthId),
          getAccountsByMonth(monthId),
        ]);

      setTransactions(trans);
      setAccounts(accs);
    };

    loadData();
  }, [monthId]);

  // 🔹 navegação
  const goPrev = () => {
    if (currentIndex <= 0)
      return;

    const newIndex =
      currentIndex - 1;

    setCurrentIndex(newIndex);

    setMonthId(
      months[newIndex].id
    );
  };

  const goNext = () => {
    if (
      currentIndex >=
      months.length - 1
    )
      return;

    const newIndex =
      currentIndex + 1;

    setCurrentIndex(newIndex);

    setMonthId(
      months[newIndex].id
    );
  };

  const currentMonth =
    months[currentIndex] || null;

  // 🔹 cálculo contas
  const getAccountValue = (
    acc: any
  ) => {
    const baseValue = Number(
      acc?.value || 0
    );

    if (
      !String(acc?.name || "").includes(
        "Nubank"
      )
    ) {
      return baseValue;
    }

    const totalTransactions =
      transactions
        .filter(
          (t) =>
            t.accountId === acc.id
        )
        .reduce(
          (sum, t) =>
            sum +
            Number(
              t.value || 0
            ),
          0
        );

    return (
      baseValue +
      totalTransactions
    );
  };

  const cartaoAccount =
    accounts.find((a) =>
      a.name
        ?.toLowerCase()
        .includes("nubank")
    );

  const cartao =
    cartaoAccount
      ? getAccountValue(
          cartaoAccount
        )
      : 0;

  const filteredTransactions =
    transactions.filter((transaction) => {
      const launcherName =
        getLauncherName(transaction);

      if (launcherFilter === "all")
        return true;

      return (
        launcherName.toLowerCase() ===
        launcherFilter
      );
    });

  const monthTransactions = [
    ...filteredTransactions,
  ]
    .sort(
      (a, b) =>
        new Date(
          b.date || 0
        ).getTime() -
        new Date(
          a.date || 0
        ).getTime()
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-4 py-6 flex flex-col gap-5">

      {showAccountMenu &&
        isSideMenuOpen && (
          <div className="fixed inset-0 z-50 flex">
            <button
              className="absolute inset-0 bg-black/60"
              onClick={() =>
                setIsSideMenuOpen(false)
              }
              type="button"
              aria-label="Fechar menu"
            />

            <aside className="relative h-full w-72 max-w-[80vw] bg-zinc-950 border-r border-zinc-800 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">
                  Menu
                </h2>

                <button
                  onClick={() =>
                    setIsSideMenuOpen(false)
                  }
                  type="button"
                  aria-label="Fechar menu"
                  className="rounded-full bg-zinc-900 p-2 text-zinc-300"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSideMenuOpen(false);
                    router.push(
                      "/mobile/creditos"
                    );
                  }}
                  className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-800"
                >
                  Créditos
                </button>

                {[
                  {
                    label: "Contas Fixas",
                    href: "/mobile/fixas",
                  },
                  {
                    label: "Contas Variáveis",
                    href: "/mobile/variaveis",
                  },
                ].map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      setIsSideMenuOpen(false);
                      router.push(item.href);
                    }}
                    className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-800"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

      {/* HEADER */}
      <div className="relative flex items-center justify-center">
        {showAccountMenu && (
          <button
            onClick={() =>
              setIsSideMenuOpen(true)
            }
            type="button"
            aria-label="Abrir menu"
            className="absolute left-0 rounded-full bg-zinc-900 p-2 text-zinc-200 border border-zinc-800"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="flex items-center gap-4 bg-zinc-900 px-5 py-2 rounded-full">

          <button onClick={goPrev}>
            ←
          </button>

          <span>
            {currentMonth
              ? `${monthName(
                  currentMonth.month
                )} ${
                  currentMonth.year
                }`
              : ""}
          </span>

          <button onClick={goNext}>
            →
          </button>

        </div>
      </div>

      {/* CARTAO NUBANK */}
      <div className="bg-purple-600 p-5 rounded-2xl">

        <div className="flex justify-between items-center">

          <p
            className="text-sm opacity-80"
            onClick={() => {
              if (
                cartaoAccount &&
                !isNubankCreditCardAccount(
                  cartaoAccount
                )
              ) {
                setDetailsAccount(
                  cartaoAccount
                );
              }
            }}
          >
            {cartaoAccount
              ? formatAccountNameWithDueDay(
                  cartaoAccount
                )
              : "Cartão de Cred Nubank"}
          </p>

          <button
            onClick={() =>
              setShowValues(
                (prev) => !prev
              )
            }
          >
            {showValues ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

        </div>

        <h1 className="text-3xl font-bold mt-2">
          {renderValue(cartao)}
        </h1>

      </div>

      {/* ULTIMOS LANCAMENTOS */}
      <div className="bg-zinc-900 p-4 rounded-2xl">

        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-zinc-400">
            Últimos lançamentos
          </p>

          <select
            value={launcherFilter}
            onChange={(e) =>
              setLauncherFilter(
                e.target
                  .value as LauncherFilter
              )
            }
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 outline-none"
          >
            <option value="matheus">
              Matheus
            </option>
            <option value="giovana">
              Giovana
            </option>
            <option value="all">
              Todos
            </option>
          </select>
        </div>

        {monthTransactions.length ===
          0 && (
          <p className="text-zinc-500 text-sm">
            Nenhum lançamento ainda
          </p>
        )}

        <div className="max-h-[52vh] overflow-y-auto pr-1 flex flex-col gap-2">

          {monthTransactions.map(
            (t) => (
              <div
                key={t.id}
                className="border-b border-zinc-800 pb-2"
              >
                {(() => {
                  const launcherName =
                    getLauncherName(
                      t
                    );

                  return (
                    <>
                      <div className="flex justify-between text-sm font-medium">

                        <span>
                          {t.category ||
                            "Sem categoria"}{" "}
                          -{" "}
                          {formatDate(
                            t.date
                          )}
                        </span>

                      </div>

                      <div className="flex justify-between items-center text-xs mt-1">

                        <span className="text-zinc-500">
                          {launcherName
                            ? `${launcherName}${
                                t.note
                                  ? ` - ${t.note}`
                                  : ""
                              }`
                            : t.note ||
                              ""}
                        </span>

                        <div className="flex items-center gap-3">

                          {/* EDITAR */}
                          <button
                            className="text-red-400 font-semibold text-sm"
                            onClick={() => {
                              setEditTransaction(
                                t
                              );

                              setEditValue(
                                Number(
                                  t.value ||
                                    0
                                ).toLocaleString(
                                  "pt-BR",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )
                              );
                            }}
                          >
                            {renderValue(
                              Number(
                                t.value
                              )
                            )}
                          </button>

                          {/* EXCLUIR */}
                          <button
                            onClick={() =>
                              setDeleteTransactionData(
                                t
                              )
                            }
                          >
                            <Trash2
                              size={16}
                              className="text-zinc-500"
                            />
                          </button>

                        </div>

                      </div>
                    </>
                  );
                })()}
              </div>
            )
          )}

        </div>
      </div>

      {/* BOTÃO */}
      <button
        className="fixed bottom-6 right-6 bg-purple-600 w-16 h-16 rounded-full text-3xl shadow-lg"
        onClick={() =>
          setOpenModal(true)
        }
      >
        +
      </button>

      {/* 🔥 MODAL EDITAR */}
      {editTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">

          <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm">

            <h2 className="text-lg font-bold mb-4">
              Editar valor
            </h2>

            <input
              type="tel"
              inputMode="decimal"
              value={editValue}
              onChange={(e) =>
                setEditValue(
                  formatCurrencyInput(
                    e.target.value
                  )
                )
              }
              className="w-full bg-zinc-800 rounded-xl p-3 outline-none"
            />

            <div className="flex gap-2 mt-4">

              <button
                className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition"
                onClick={async () => {
                  if (
                    !monthId ||
                    !editTransaction
                  )
                    return;

                  await updateTransaction(
                    monthId,
                    editTransaction.id,
                    {
                      value:
                        parseCurrency(
                          editValue
                        ),
                    }
                  );

                  const refreshed =
                    await getTransactions(
                      monthId
                    );

                  setTransactions(
                    refreshed
                  );

                  setEditTransaction(
                    null
                  );

                  setEditValue("");
                }}
              >
                Salvar
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
                onClick={() => {
                  setEditTransaction(
                    null
                  );

                  setEditValue("");
                }}
              >
                Cancelar
              </button>

            </div>

          </div>
        </div>
      )}

      {/* 🔥 MODAL EXCLUIR */}
      {deleteTransactionData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">

          <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm">

            <h2 className="text-lg font-bold mb-2">
              Excluir lançamento
            </h2>

            <p className="text-sm text-zinc-400">
              Deseja realmente excluir este lançamento?
            </p>

            <div className="flex gap-2 mt-5">

              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
                onClick={async () => {
                  if (
                    !monthId ||
                    !deleteTransactionData
                  )
                    return;

                  await deleteTransaction(
                    monthId,
                    deleteTransactionData.id
                  );

                  const refreshed =
                    await getTransactions(
                      monthId
                    );

                  setTransactions(
                    refreshed
                  );

                  setDeleteTransactionData(
                    null
                  );
                }}
                type="button"
                autoFocus
              >
                Confirmar
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
                onClick={() =>
                  setDeleteTransactionData(
                    null
                  )
                }
                type="button"
              >
                Cancelar
              </button>

            </div>

          </div>
        </div>
      )}

      {/* 🔥 MODAL LANÇAMENTO */}
      <LaunchModal
        open={openModal}
        onClose={() =>
          setOpenModal(false)
        }
        monthId={monthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={
          setTransactions
        }
        onMonthsChanged={async (
          targetMonthId
        ) => {
          const refreshed =
            await getAllMonths();

          setMonths(refreshed);

          const targetIndex =
            refreshed.findIndex(
              (month: any) =>
                month.id ===
                targetMonthId
            );

          if (targetIndex >= 0) {
            setCurrentIndex(
              targetIndex
            );

            setMonthId(
              targetMonthId
            );
          }
        }}
      />

      <EditAccountModal
        open={Boolean(
          detailsAccount
        )}
        onClose={() =>
          setDetailsAccount(
            null
          )
        }
        monthId={monthId}
        account={detailsAccount}
        setAccounts={setAccounts}
      />

    </div>
  );
}
