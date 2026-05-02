"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "../../lib/auth";
import { getAllMonths } from "../../services/monthService";
import { getAccountsByMonth } from "../../services/accountService";
import {
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../../services/transactionService";
import TransactionList from "../../components/TransactionList";
import { ALLOWED_USERS } from "../../config/allowedUsers";

type MonthDoc = {
  id: string;
  year: number;
  month: number;
};

type Transaction = {
  id: string;
  accountId: string;
  date: string;
  value: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
};

type ExtratoItem = {
  id: string;
  transactionId: string;
  monthId: string;
  date: string;
  value: number;
  monthLabel: string;
  monthOrder: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
};

type TransactionGroup = {
  monthLabel: string;
  items: ExtratoItem[];
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type LauncherFilter = "Matheus" | "Giovana" | "all";

function ExtratoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonthId = searchParams.get("monthId");

  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState(true);

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentLauncherName, setCurrentLauncherName] =
    useState<LauncherFilter | "">("");

  const [allItems, setAllItems] = useState<ExtratoItem[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [monthTitle, setMonthTitle] = useState("Extrato Nubank");

  const [filterDate, setFilterDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLauncher, setFilterLauncher] =
    useState<LauncherFilter>("all");

  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<ExtratoItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [itemToDelete, setItemToDelete] =
    useState<ExtratoItem | null>(null);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const parseCurrency = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatMonthLabel = (month: number, year: number) =>
    `Fatura ${String(month).padStart(2, "0")}/${year}`;

  const normalizeLauncherName = (value: string) => {
    const lower = String(value || "").toLowerCase();

    if (lower.includes("matheus")) return "Matheus";
    if (lower.includes("giovana")) return "Giovana";

    return "";
  };

  const resolveCurrentLauncher = (user: any): LauncherFilter | "" => {
    const raw = `${user?.displayName || ""} ${user?.email || ""}`;
    return normalizeLauncherName(raw) as LauncherFilter | "";
  };

  const getItemLauncher = (item: ExtratoItem) => {
    if (item.launcherName) {
      const normalized = normalizeLauncherName(item.launcherName);
      if (normalized) return normalized;
    }

    if (!currentUserId || !item.userId || !currentLauncherName) {
      return "";
    }

    if (item.userId === currentUserId) {
      return currentLauncherName;
    }

    if (currentLauncherName === "Matheus") return "Giovana";
    if (currentLauncherName === "Giovana") return "Matheus";

    return "";
  };

  const normalizeDateKey = (value: string) => {
    if (!value) return "";

    const trimmed = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.includes("T")) {
      return trimmed.slice(0, 10);
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const loadExtrato = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/");
      return;
    }

    setLoading(true);

    try {
      const months = (await getAllMonths()) as MonthDoc[];

      const targetMonth =
        months.find((m) => m.id === requestedMonthId) ||
        months[months.length - 1];

      if (!targetMonth) {
        setAllItems([]);
        setGroups([]);
        setTotal(0);
        setMonthTitle("Extrato Nubank");
        return;
      }

      const [accounts, transactions] = (await Promise.all([
        getAccountsByMonth(targetMonth.id),
        getTransactions(targetMonth.id),
      ])) as [any[], Transaction[]];

      const nubankAccounts = accounts.filter((a: any) =>
        String(a.name || "").includes("Nubank")
      );

      const nubankIds = new Set(nubankAccounts.map((a: any) => String(a.id)));

      const label = formatMonthLabel(targetMonth.month, targetMonth.year);
      const monthOrder = targetMonth.year * 100 + targetMonth.month;

      const items: ExtratoItem[] = [];

      for (const t of transactions || []) {
        if (!t || !t.accountId) continue;
        if (!nubankIds.has(String(t.accountId))) continue;

        items.push({
          id: `${targetMonth.id}-${t.id || Math.random()}`,
          transactionId: String(t.id),
          monthId: targetMonth.id,
          date: t.date ? String(t.date) : "",
          value: Number(t.value ?? 0),
          monthLabel: label,
          monthOrder,
          note: t.note ? String(t.note) : "",
          category: t.category ? String(t.category) : "",
          userId: t.userId ? String(t.userId) : "",
          userName: t.userName ? String(t.userName) : "",
          launcherId: t.launcherId ? String(t.launcherId) : "",
          launcherName: t.launcherName ? String(t.launcherName) : "",
        });
      }

      items.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (db !== da) return db - da;
        return b.monthOrder - a.monthOrder;
      });

      setMonthTitle(label);
      setAllItems(items);
    } finally {
      setLoading(false);
    }
  }, [requestedMonthId, router]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      if (!user.email || !ALLOWED_USERS.includes(user.email)) {
        await auth.signOut();
        router.push("/");
        return;
      }

      setCurrentUserId(user.uid);

      const launcher = resolveCurrentLauncher(user);
      setCurrentLauncherName(launcher);
      setFilterLauncher(launcher || "all");

      await loadExtrato();
    });

    return () => unsub();
  }, [loadExtrato, router]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filterDate) {
        const itemDateKey = normalizeDateKey(item.date);
        if (itemDateKey !== filterDate) return false;
      }

      if (filterCategory) {
        if ((item.category || "") !== filterCategory) return false;
      }

      if (filterLauncher !== "all") {
        const itemLauncher = getItemLauncher(item);
        if (itemLauncher !== filterLauncher) return false;
      }

      return true;
    });
  }, [
    allItems,
    filterDate,
    filterCategory,
    filterLauncher,
    currentUserId,
    currentLauncherName,
  ]);

  useEffect(() => {
    const grouped: TransactionGroup[] = [
      {
        monthLabel: monthTitle,
        items: filteredItems,
      },
    ];

    setGroups(grouped);
    setTotal(filteredItems.reduce((sum, item) => sum + item.value, 0));
  }, [filteredItems, monthTitle]);

  const categories = useMemo(() => {
    const unique = [...new Set(allItems.map((i) => i.category).filter(Boolean))];
    return unique as string[];
  }, [allItems]);

  const openEdit = (item: ExtratoItem) => {
    setEditItem(item);
    setEditValue(String(item.value ?? ""));
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editItem || !editItem.monthId || !editItem.transactionId) return;

    const parsed = parseCurrency(editValue);
    if (Number.isNaN(parsed)) return;

    setSaving(true);
    try {
      await updateTransaction(editItem.monthId, editItem.transactionId, {
        value: parsed,
      });

      await loadExtrato();
      setShowEdit(false);
      setEditItem(null);
      setEditValue("");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (item: ExtratoItem) => {
    setItemToDelete(item);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    await deleteTransaction(itemToDelete.monthId, itemToDelete.transactionId);
    await loadExtrato();

    setShowDelete(false);
    setItemToDelete(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Extrato Nubank</h1>
          <p className="text-zinc-400 text-sm">
            Lançamentos da fatura do mês selecionado
          </p>
        </div>

<div className="flex gap-2">
  <button
    onClick={() =>
      router.push(`/extrato-total?monthId=${requestedMonthId}`)
    }
    className="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-xl"
    type="button"
  >
    Extrato completo
  </button>

  <button
    onClick={() => router.push("/dashboard")}
    className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl"
    type="button"
  >
    Voltar
  </button>
</div>
      </div>

      <div className="bg-purple-800 p-6 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <p className="text-sm text-purple-200">Total do extrato</p>
          <h2 className="text-3xl font-bold">
            {showValues ? formatMoney(total) : "R$ ••••••"}
          </h2>
        </div>

        <button
          onClick={() => setShowValues((prev) => !prev)}
          type="button"
          className="text-3xl leading-none opacity-90 hover:opacity-100 transition"
          aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3l18 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M10.6 10.8a3.2 3.2 0 0 0 4.6 4.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7.4 7.6C4.9 9.2 3.3 12 3.3 12s3.5 6.5 8.7 6.5c1 0 1.9-.1 2.7-.4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.7 5.7A11.4 11.4 0 0 1 12 5.5C17.1 5.5 20.7 12 20.7 12a17.4 17.4 0 0 1-2.2 3.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_240px_160px] items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Data</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            >
              <option value="">Todas categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">
              Quem lançou
            </label>
            <select
              value={filterLauncher}
              onChange={(e) =>
                setFilterLauncher(e.target.value as LauncherFilter)
              }
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            >
              <option value="Matheus">Lançamentos Matheus</option>
              <option value="Giovana">Lançamentos Giovana</option>
              <option value="all">Todos os Lançamentos</option>
            </select>
          </div>

          <button
            onClick={() => {
              setFilterDate("");
              setFilterCategory("");
              setFilterLauncher(currentLauncherName || "all");
            }}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl h-[42px]"
            type="button"
          >
            Limpar filtros
          </button>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Fatura: {monthTitle}
          {filterDate ? ` • Data: ${filterDate}` : ""}
          {filterCategory ? ` • Categoria: ${filterCategory}` : ""}
          {filterLauncher === "Matheus"
            ? " • Lançamentos Matheus"
            : filterLauncher === "Giovana"
            ? " • Lançamentos Giovana"
            : " • Todos os Lançamentos"}
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : groups[0]?.items?.length ? (
        <TransactionList
          groups={groups}
          showValues={showValues}
          formatMoney={formatMoney}
          onEdit={openEdit}
          onDelete={askDelete}
        />
      ) : (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 text-zinc-400">
          Nenhum lançamento encontrado com os filtros atuais.
        </div>
      )}

      {showEdit && editItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">Editar valor lançado</h2>

            <p className="text-sm text-zinc-400 mb-3">
              {editItem.category || "Lançamento"}
            </p>

            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-2 bg-zinc-800 rounded mb-3"
              placeholder="Novo valor"
            />

            <div className="flex justify-between">
              <button
                onClick={saveEdit}
                className="bg-green-600 px-4 py-2 rounded disabled:opacity-60"
                disabled={saving}
                type="button"
              >
                Salvar
              </button>

              <button
                onClick={() => {
                  setShowEdit(false);
                  setEditItem(null);
                  setEditValue("");
                }}
                className="bg-red-600 px-4 py-2 rounded"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && itemToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-4 text-lg font-bold">
              Deseja excluir este lançamento?
            </h2>

            <div className="flex justify-between">
              <button
                onClick={confirmDelete}
                className="bg-red-600 px-4 py-2 rounded"
                type="button"
              >
                Sim
              </button>

              <button
                onClick={() => {
                  setShowDelete(false);
                  setItemToDelete(null);
                }}
                className="bg-gray-600 px-4 py-2 rounded"
                type="button"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExtratoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ExtratoContent />
    </Suspense>
  );
}