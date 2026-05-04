"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/auth";
import { getTransactions } from "../../services/transactionService";
import { getAllMonths } from "../../services/monthService";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

type MonthDoc = {
  id: string;
  year: number;
  month: number;
};

type LauncherFilter = "all" | "Matheus" | "Giovana";

const COLORS = [
  "#8B5CF6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#EC4899",
  "#14B8A6",
  "#A855F7",
];

export default function ExtratoTotalPage() {
  const router = useRouter();

  const [months, setMonths] = useState<MonthDoc[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [launcherFilter, setLauncherFilter] =
    useState<LauncherFilter>("all");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const normalizeLauncher = (value: string) => {
    const v = String(value || "").toLowerCase();
    if (v.includes("matheus")) return "Matheus";
    if (v.includes("giovana")) return "Giovana";
    return "";
  };

  useEffect(() => {
    const load = async () => {
      const data = (await getAllMonths()) as MonthDoc[];
      setMonths(data);

      if (data.length) {
        const last = data[data.length - 1];
        setSelectedYear(Number(last.year));
      }
    };

    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!selectedYear) return;

      const user = auth.currentUser;
      if (!user) return router.push("/");

      setLoading(true);

      let targetMonths = months.filter(
        (m) => Number(m.year) === selectedYear
      );

      if (selectedMonth) {
        targetMonths = targetMonths.filter(
          (m) => Number(m.month) === selectedMonth
        );
      }

      let all: any[] = [];

      for (const m of targetMonths) {
        const trans = await getTransactions(m.id);

        const enriched = trans.map((t: any) => ({
          ...t,
          month: m.month,
        }));

        all = [...all, ...enriched];
      }

      setTransactions(all);
      setLoading(false);
    };

    load();
  }, [selectedYear, selectedMonth, months, router]);

  const filteredTransactions = useMemo(() => {
    if (launcherFilter === "all") return transactions;

    return transactions.filter((t) => {
      const launcher =
        normalizeLauncher(t.launcherName) ||
        normalizeLauncher(t.userName);

      return launcher === launcherFilter;
    });
  }, [transactions, launcherFilter]);

  const categories = useMemo(() => {
    return [
      ...new Set(
        filteredTransactions.map(
          (t) => t.category || "Sem categoria"
        )
      ),
    ];
  }, [filteredTransactions]);

  const matrix = useMemo(() => {
    const result: Record<number, Record<string, number>> = {};

    filteredTransactions.forEach((t) => {
      const month = t.month;
      const category = t.category || "Sem categoria";

      if (!result[month]) result[month] = {};
      if (!result[month][category]) result[month][category] = 0;

      result[month][category] += Number(t.value || 0);
    });

    return result;
  }, [filteredTransactions]);

  const monthsOfYear = useMemo(() => {
    return months
      .filter((m) => Number(m.year) === selectedYear)
      .map((m) => m.month)
      .sort((a, b) => a - b);
  }, [months, selectedYear]);

  const totalGeral = filteredTransactions.reduce(
    (sum, t) => sum + Number(t.value || 0),
    0
  );

  const totalPorCategoria = useMemo(() => {
    const totals: Record<string, number> = {};

    categories.forEach((cat) => {
      totals[cat] = filteredTransactions
        .filter(
          (t) => (t.category || "Sem categoria") === cat
        )
        .reduce((sum, t) => sum + Number(t.value || 0), 0);
    });

    return totals;
  }, [filteredTransactions, categories]);

  const pieData = Object.entries(totalPorCategoria).map(
    ([name, value]) => ({ name, value })
  );

  const barData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;

    const total = filteredTransactions
      .filter((t) => t.month === month)
      .reduce((sum, t) => sum + Number(t.value || 0), 0);

    return {
      name: String(month).padStart(2, "0"),
      total,
    };
  });

  const years = [...new Set(months.map((m) => Number(m.year)))];

  const monthName = (m: number) =>
    [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
    ][m - 1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-6 py-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold whitespace-nowrap">
            Extrato Total
          </h1>

          <select
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-zinc-800 px-4 py-2 rounded-lg outline-none border border-zinc-700"
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>

          <select
            value={selectedMonth ?? ""}
            onChange={(e) =>
              setSelectedMonth(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="bg-zinc-800 px-4 py-2 rounded-lg outline-none border border-zinc-700"
          >
            <option value="">Todos</option>
            {monthsOfYear.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>

          <select
            value={launcherFilter}
            onChange={(e) =>
              setLauncherFilter(e.target.value as LauncherFilter)
            }
            className="bg-zinc-800 px-4 py-2 rounded-lg outline-none border border-zinc-700"
          >
            <option value="all">Todos</option>
            <option value="Matheus">Matheus</option>
            <option value="Giovana">Giovana</option>
          </select>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl transition"
          type="button"
        >
          Voltar
        </button>
      </div>

      {/* TABELA */}
      <div className="bg-zinc-900/70 rounded-2xl overflow-auto border border-zinc-800 shadow-2xl shadow-black/20">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/90 text-zinc-200">
            <tr>
              <th className="p-4 text-left">Mes</th>

              {categories.map((cat) => (
                <th key={cat} className="p-4 text-center whitespace-nowrap">
                  {cat}
                </th>
              ))}

              <th className="p-4 text-right text-green-300">Total</th>
            </tr>
          </thead>

          <tbody>
            {(selectedMonth ? [selectedMonth] : monthsOfYear).map((m) => {
              const monthData = matrix[m] || {};

              const totalMes = Object.values(monthData).reduce(
                (sum, v) => sum + v,
                0
              );

              return (
                <tr
                  key={m}
                  className="border-t border-zinc-800 hover:bg-zinc-800/50 transition"
                >
                  <td className="p-4 font-semibold">{monthName(m)}</td>

                  {categories.map((cat) => (
                    <td key={cat} className="p-4 text-center whitespace-nowrap">
                      {monthData[cat]
                        ? formatMoney(monthData[cat])
                        : <span className="text-zinc-600">-</span>}
                    </td>
                  ))}

                  <td className="p-4 text-right font-bold text-zinc-100 whitespace-nowrap">
                    {formatMoney(totalMes)}
                  </td>
                </tr>
              );
            })}

            <tr className="border-t border-zinc-700 bg-zinc-800/95 font-bold">
              <td className="p-4">Total</td>

              {categories.map((cat) => (
                <td key={cat} className="p-4 text-center whitespace-nowrap">
                  {formatMoney(totalPorCategoria[cat] || 0)}
                </td>
              ))}

              <td className="p-4 text-right text-green-400 whitespace-nowrap">
                {formatMoney(totalGeral)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

        <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
          <div className="mb-3">
            <h2 className="font-semibold">Categorias</h2>
            <p className="text-xs text-zinc-500">Distribuicao do total</p>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                innerRadius={40}
                outerRadius={70}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip
                formatter={(v: any) => formatMoney(Number(v))}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800">
          <div className="mb-3">
            <h2 className="font-semibold">Mes a mes</h2>
            <p className="text-xs text-zinc-500">Evolucao dos gastos</p>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData}>
              <XAxis stroke="#a1a1aa" dataKey="name" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip
                formatter={(v: any) => formatMoney(Number(v))}
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="total" fill="#8B5CF6" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
