"use client";

import AppHeader from "../../../../components/AppHeader";
import MonthSelect from "../../../../components/MonthSelect";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import type { User } from "firebase/auth";
import type { FinanceMonth } from "../../../../domain/finance/month";

type Props = {
  user: User | null;
  activeSpace: "family" | "personal";
  showPaymentSchedule: boolean;
  onTogglePaymentSchedule: () => void;
  extratoHref: string;
  months: FinanceMonth[];
  currentIndex: number;
  onLoadMonth: (index: number) => void;
  onCreateMonth: () => void;
  onLaunch: () => void;
  showUserMenu: boolean;
  onToggleUserMenu: () => void;
  onSwitchSpace: () => void;
  onOpenMembers: () => void;
  onOpenMoreOptions: () => void;
  onLogout: () => void;
};

function getInitials(email?: string | null) {
  if (!email) return "?";
  const prefix = email.split("@")[0];
  const parts = prefix.split(/[._-]/g).filter(Boolean);

  if (!parts.length) return prefix.slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

export default function DashboardHeader({
  user,
  activeSpace,
  showPaymentSchedule,
  onTogglePaymentSchedule,
  extratoHref,
  months,
  currentIndex,
  onLoadMonth,
  onCreateMonth,
  onLaunch,
  showUserMenu,
  onToggleUserMenu,
  onSwitchSpace,
  onOpenMembers,
  onOpenMoreOptions,
  onLogout,
}: Props) {
  return (
    <AppHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 text-sm">Controle financeiro</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onTogglePaymentSchedule}
          aria-label="Agenda financeira"
          title="Agenda financeira"
          aria-pressed={showPaymentSchedule}
          className={`rounded-xl p-2 transition focus-visible:outline-2 focus-visible:outline-purple-400 ${showPaymentSchedule ? "bg-purple-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          <CalendarDays size={24} />
        </button>
        <Link href={extratoHref} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl transition">
          Extrato
        </Link>
        <Link href="/relatorio-mensal" className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl transition">
          Relatório mensal
        </Link>
        <button onClick={onCreateMonth} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl" type="button">
          Novo mês
        </button>
        <button onClick={onLaunch} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl shadow" type="button">
          + Lançar
        </button>

        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-2 py-1 ml-4">
          <button onClick={() => currentIndex > 0 && onLoadMonth(currentIndex - 1)} className="px-3 py-1 rounded-full hover:bg-zinc-800" type="button">
            ←
          </button>
          <MonthSelect months={months} currentIndex={currentIndex} onSelect={onLoadMonth} />
          <button onClick={() => currentIndex < months.length - 1 && onLoadMonth(currentIndex + 1)} className="px-3 py-1 rounded-full hover:bg-zinc-800" type="button">
            →
          </button>
        </div>

        <div className="relative ml-2">
          <button
            onClick={onToggleUserMenu}
            className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg overflow-hidden"
            type="button"
            aria-label="Menu do usuário"
          >
            {user?.photoURL ? (
              <Image src={user.photoURL} alt="Foto do usuário" width={40} height={40} unoptimized className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold">{getInitials(user?.email)}</span>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 bg-zinc-900 rounded shadow p-2 z-50">
              <button onClick={onSwitchSpace} className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left" type="button">
                {activeSpace === "personal" ? "Família" : "Pessoal"}
              </button>
              <button onClick={onOpenMembers} className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left" type="button">
                Membros
              </button>
              <button onClick={onOpenMoreOptions} className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left" type="button">
                Mais opções
              </button>
              <button onClick={onLogout} className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left" type="button">
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </AppHeader>
  );
}
