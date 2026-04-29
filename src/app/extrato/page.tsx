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

  const normalizeDateKey = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
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

      if (!targetMonth) return;

      const [accounts, transactions] = await Promise.all([
        getAccountsByMonth(targetMonth.id),
        getTransactions(targetMonth.id),
      ]);

      const nubankIds = new Set(
        accounts
          .filter((a: any) =>
            String(a.name || "").includes("Nubank")
          )
          .map((a: any) => a.id)
      );

      const items = transactions
        .filter((t: any) => nubankIds.has(t.accountId))
        .map((t: any) => ({
          id: `${targetMonth.id}-${t.id}`,
          transactionId: t.id,
          monthId: targetMonth.id,
          date: t.date,
          value: t.value,
          monthLabel: "",
          monthOrder: 0,
        }));

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

  return <div>Extrato funcionando 🚀</div>;
}

export default function ExtratoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ExtratoContent />
    </Suspense>
  );
}