"use client";

import AppHeader from "../../../../components/AppHeader";
import MonthSelect from "../../../../components/MonthSelect";
import Image from "next/image";
import type { FinanceMonth } from "../../../../domain/finance/month";
import type { User } from "firebase/auth";
import { Menu, X } from "lucide-react";

type MobileDashboardHeaderProps = {
  user: User | null;
  showAccountMenu: boolean;
  isSideMenuOpen: boolean;
  showUserMenu: boolean;
  activeSpace: "family" | "personal";
  months: FinanceMonth[];
  currentIndex: number;
  monthId: string | null;
  onSideMenuChange: (open: boolean) => void;
  onUserMenuChange: (open: boolean) => void;
  onSwitchSpace: () => void;
  onOpenMembers: () => void;
  onOpenMoreOptions: () => void;
  onLogout: () => void;
  onNavigate: (href: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth: (index: number) => void;
};

const getInitials = (email?: string | null) => {
  if (!email) return "?";
  const prefix = email.split("@")[0];
  const parts = prefix.split(/[._-]/g).filter(Boolean);
  if (!parts.length) return prefix.slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
};

export default function MobileDashboardHeader({
  user,
  showAccountMenu,
  isSideMenuOpen,
  showUserMenu,
  activeSpace,
  months,
  currentIndex,
  monthId,
  onSideMenuChange,
  onUserMenuChange,
  onSwitchSpace,
  onOpenMembers,
  onOpenMoreOptions,
  onLogout,
  onNavigate,
  onPreviousMonth,
  onNextMonth,
  onSelectMonth,
}: MobileDashboardHeaderProps) {
  return (
    <>
      {showAccountMenu && isSideMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => onSideMenuChange(false)}
            type="button"
            aria-label="Fechar menu"
          />
          <aside className="relative h-full w-72 max-w-[80vw] bg-zinc-950 border-r border-zinc-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Menu</h2>
              <button
                onClick={() => onSideMenuChange(false)}
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
                onClick={() => { onSideMenuChange(false); onNavigate("/mobile/creditos"); }}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-800"
              >
                Créditos
              </button>
              <button
                type="button"
                onClick={() => {
                  onSideMenuChange(false);
                  onNavigate(`/mobile/agenda${monthId ? `?month=${encodeURIComponent(monthId)}` : ""}`);
                }}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-800"
              >
                Agenda financeira
              </button>
              {[
                { label: "Contas Fixas", href: "/mobile/fixas" },
                { label: "Contas Variáveis", href: "/mobile/variaveis" },
              ].map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => { onSideMenuChange(false); onNavigate(item.href); }}
                  className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-100 border border-zinc-800"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <AppHeader className="">
        <div className="relative flex items-center justify-center">
          {showAccountMenu && (
            <button
              onClick={() => onSideMenuChange(true)}
              type="button"
              aria-label="Abrir menu"
              className="absolute left-0 rounded-full bg-zinc-900 p-2 text-zinc-200 border border-zinc-800"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="absolute right-0">
            <button
              onClick={() => onUserMenuChange(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg overflow-hidden border border-purple-400/20"
              type="button"
              aria-label="Abrir menu do usuario"
            >
              {user?.photoURL ? (
                <Image src={user.photoURL} alt="Foto do usuario" width={40} height={40} unoptimized className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-sm">{getInitials(user?.email)}</span>
              )}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 min-w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50">
                <button onClick={onSwitchSpace} className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm" type="button">
                  {activeSpace === "personal" ? "Família" : "Pessoal"}
                </button>
                <button onClick={onOpenMembers} className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm" type="button">
                  Membros
                </button>
                <button onClick={onOpenMoreOptions} className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm" type="button">
                  Mais opções
                </button>
                <button onClick={onLogout} className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm" type="button">
                  Sair
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 bg-zinc-900 px-5 py-2 rounded-full">
            <button onClick={onPreviousMonth} type="button">←</button>
            <MonthSelect months={months} currentIndex={currentIndex} onSelect={onSelectMonth} />
            <button onClick={onNextMonth} type="button">→</button>
          </div>
        </div>
      </AppHeader>
    </>
  );
}
