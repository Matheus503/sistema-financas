"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { auth } from "../../lib/auth";
import { getAllMonths } from "../../services/monthService";
import { getTransactions } from "../../services/transactionService";
import { getAccountsByMonth } from "../../services/accountService";

import LaunchModal from "../../components/LaunchModal";

export default function MobileDashboard() {
  const router = useRouter();

  const [months, setMonths] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [monthId, setMonthId] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [openModal, setOpenModal] = useState(false);
  const [showValues, setShowValues] = useState(false);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const renderValue = (value: number) =>
    showValues ? formatMoney(value) : "••••••";

  const formatDate = (date: string) => {
    if (!date) return "";
    const dateKey = String(date).slice(0, 10);
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);

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
    ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m - 1];

  // 🔹 carregar meses
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return router.push("/");

      const all = await getAllMonths();
      if (!all || all.length === 0) return;

      setMonths(all);

      const lastIndex = all.length - 1;
      setCurrentIndex(lastIndex);
      setMonthId(all[lastIndex].id);
    };

    load();
  }, [router]);

  // 🔹 carregar dados
  useEffect(() => {
    const loadData = async () => {
      if (!monthId) return;

      const [trans, accs] = await Promise.all([
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
    if (currentIndex <= 0) return;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    setMonthId(months[newIndex].id);
  };

  const goNext = () => {
    if (currentIndex >= months.length - 1) return;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    setMonthId(months[newIndex].id);
  };

  const currentMonth = months[currentIndex] || null;

  // 🔹 cálculo contas
  const getAccountValue = (acc: any) => {
    const baseValue = Number(acc?.value || 0);

    const totalTransactions = transactions
      .filter((t) => t.accountId === acc.id)
      .reduce((sum, t) => sum + Number(t.value || 0), 0);

    return baseValue + totalTransactions;
  };

  const saldo =
    accounts
      .filter((a) => a.type === "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0)
    -
    accounts
      .filter((a) => a.type !== "CREDIT")
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

  const cartao = (() => {
    const acc = accounts.find((a) =>
      a.name?.toLowerCase().includes("nubank")
    );
    return acc ? getAccountValue(acc) : 0;
  })();

  // 🔥 últimos 5 lançamentos
  const lastTransactions = [...transactions]
    .sort((a, b) =>
      new Date(b.date || 0).getTime() -
      new Date(a.date || 0).getTime()
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-4 py-6 flex flex-col gap-5">

      {/* HEADER */}
      <div className="flex justify-center">
        <div className="flex items-center gap-4 bg-zinc-900 px-5 py-2 rounded-full">
          <button onClick={goPrev}>←</button>

          <span>
            {currentMonth
              ? `${monthName(currentMonth.month)} ${currentMonth.year}`
              : ""}
          </span>

          <button onClick={goNext}>→</button>
        </div>
      </div>

      {/* SALDO */}
      <div className="bg-purple-600 p-5 rounded-2xl">
        <div className="flex justify-between items-center">
          <p className="text-sm opacity-80">Saldo do mês</p>

          <button onClick={() => setShowValues((prev) => !prev)}>
            {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <h1 className="text-3xl font-bold mt-2">
          {renderValue(saldo)}
        </h1>
      </div>

      {/* CARTÃO */}
      <div className="bg-zinc-900 p-4 rounded-2xl">
        <p className="text-sm text-zinc-400">Cartão Nubank</p>

        <h2 className="text-xl font-bold text-red-400 mt-1">
          {renderValue(cartao)}
        </h2>
      </div>

      {/* ÚLTIMOS LANÇAMENTOS */}
      <div className="bg-zinc-900 p-4 rounded-2xl">
        <p className="text-sm text-zinc-400 mb-3">
          Últimos lançamentos
        </p>

        {lastTransactions.length === 0 && (
          <p className="text-zinc-500 text-sm">
            Nenhum lançamento ainda
          </p>
        )}

        <div className="flex flex-col gap-2">
          {lastTransactions.map((t) => (
            <div key={t.id} className="border-b border-zinc-800 pb-2">

              <div className="flex justify-between text-sm font-medium">
                <span>
                  {t.category || "Sem categoria"} - {formatDate(t.date)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs mt-1">
                <span className="text-zinc-500">
                  {t.note || ""}
                </span>

                <span className="text-red-400 font-semibold text-sm">
                  {renderValue(Number(t.value))}
                </span>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* BOTÃO */}
      <button
        className="fixed bottom-6 right-6 bg-purple-600 w-16 h-16 rounded-full text-3xl"
        onClick={() => setOpenModal(true)}
      >
        +
      </button>

      {/* 🔥 LaunchModal (MESMA LÓGICA DO DESKTOP) */}
      <LaunchModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        monthId={monthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={setTransactions}
        onMonthsChanged={async (targetMonthId) => {
          const refreshed = await getAllMonths();
          setMonths(refreshed);

          const targetIndex = refreshed.findIndex(
            (month: any) => month.id === targetMonthId
          );

          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex);
            setMonthId(targetMonthId);
          }
        }}
      />

    </div>
  );
}
