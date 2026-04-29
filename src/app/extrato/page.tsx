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
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type LauncherFilter = "Matheus" | "Giovana" | "all";

function ExtratoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonthId = searchParams.get("monthId");

  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState(true);

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentLauncherName, setCurrentLauncherName] = useState<LauncherFilter | "">("");

  const [allItems, setAllItems] = useState<ExtratoItem[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [monthTitle, setMonthTitle] = useState("Extrato Nubank");

  const [filterDate, setFilterDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLauncher, setFilterLauncher] = useState<LauncherFilter>("all");

  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<ExtratoItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ExtratoItem | null>(null);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

    if (!currentUserId || !item.userId || !currentLauncherName) return "";

    if (item.userId === currentUserId) return currentLauncherName;

    if (currentLauncherName === "Matheus") return "Giovana";
    if (currentLauncherName === "Giovana") return "Matheus";

    return "";
  };

  const normalizeDateKey = (value: string) => {
    if (!value) return "";
    const trimmed = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes("T")) return trimmed.slice(0, 10);

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return "";

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const loadExtrato = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return router.push("/");

    setLoading(true);

    try {
      const months = (await getAllMonths()) as MonthDoc[];

      const targetMonth =
        months.find((m) => m.id === requestedMonthId) ||
        months[months.length - 1];

      if (!targetMonth) return;

      const [accounts, transactions] = await Promise.all([
        getAccountsByMonth(targetMonth.id),
        getTransactions(targetMonth.id),
      ]);

      const nubankIds = new Set(
        accounts.filter((a: any) => String(a.name).includes("Nubank")).map((a: any) => a.id)
      );

      const label = formatMonthLabel(targetMonth.month, targetMonth.year);
      const monthOrder = targetMonth.year * 100 + targetMonth.month;

      const items = transactions
        .filter((t: any) => nubankIds.has(t.accountId))
        .map((t: any) => ({
          id: `${targetMonth.id}-${t.id}`,
          transactionId: t.id,
          monthId: targetMonth.id,
          date: t.date,
          value: t.value,
          monthLabel: label,
          monthOrder,
          note: t.note,
          category: t.category,
          userId: t.userId,
          userName: t.userName,
          launcherName: t.launcherName,
        }));

      setMonthTitle(label);
      setAllItems(items);
    } finally {
      setLoading(false);
    }
  }, [requestedMonthId, router]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return router.push("/");

      if (!user.email || !ALLOWED_USERS.includes(user.email)) {
        alert("Acesso não autorizado");
        await auth.signOut();
        return router.push("/");
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
      if (filterDate && normalizeDateKey(item.date) !== filterDate) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterLauncher !== "all" && getItemLauncher(item) !== filterLauncher) return false;
      return true;
    });
  }, [allItems, filterDate, filterCategory, filterLauncher]);

  useEffect(() => {
    setGroups([{ monthLabel: monthTitle, items: filteredItems }]);
    setTotal(filteredItems.reduce((sum, i) => sum + i.value, 0));
  }, [filteredItems, monthTitle]);

  const categories = useMemo(() => {
    return [...new Set(allItems.map((i) => i.category).filter(Boolean))] as string[];
  }, [allItems]);

  const openEdit = (item: ExtratoItem) => {
    setEditItem(item);
    setEditValue(String(item.value));
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const value = parseCurrency(editValue);

    await updateTransaction(editItem.monthId, editItem.transactionId, { value });
    await loadExtrato();

    setShowEdit(false);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    await deleteTransaction(itemToDelete.monthId, itemToDelete.transactionId);
    await loadExtrato();
    setShowDelete(false);
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">{monthTitle}</h1>

      <p className="mb-4">Total: {formatMoney(total)}</p>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <TransactionList
          groups={groups}
          showValues={showValues}
          formatMoney={formatMoney}
          onEdit={openEdit}
          onDelete={(i) => setItemToDelete(i)}
        />
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