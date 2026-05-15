"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { auth } from "../../lib/auth";
import { createMonth, getAllMonths } from "../../services/monthService";
import {
  deleteAccount,
  updateAccountsOrder,
  updateAccountExpectedValue,
  updateAccountValue,
} from "../../services/accountService";
import type { FinanceAccount } from "../../services/accountService";

import AccountColumn from "../../components/AccountColumn";
import LaunchModal from "../../components/LaunchModal";
import CreateAccountModal from "../../components/CreateAccountModal";
import EditAccountModal from "../../components/EditAccountModal";
import { useFinance } from "../../hooks/useFinance";
import { ALLOWED_USERS } from "../../config/allowedUsers";

function EyeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showValues, setShowValues] = useState(false);

  const [months, setMonths] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [monthId, setMonthId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    type: string | null;
  }>({
    open: false,
    type: null,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [showCreateMonthModal, setShowCreateMonthModal] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [editValue, setEditValue] = useState("");
  const [detailsAccount, setDetailsAccount] = useState<FinanceAccount | null>(null);
  const [showExpectedEdit, setShowExpectedEdit] = useState(false);
  const [expectedAccount, setExpectedAccount] = useState<any>(null);
  const [expectedValue, setExpectedValue] = useState("");

  const [showUserMenu, setShowUserMenu] = useState(false);

  const {
    accounts,
    setAccounts,
    setTransactions,
    loadData,
    handleTogglePaid,
    getAccountValue,
    saldo,
  } = useFinance();

  const formatMoney = (v: number) => {
    if (!showValues) return "R$ ••••••";
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const parseCurrency = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, "").replace(",", "."));
  };

  const formatCurrencyInput = (value: number) => {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getInitials = (email: string) => {
    if (!email) return "?";
    const prefix = email.split("@")[0];
    const parts = prefix.split(/[._-]/g).filter(Boolean);

    if (!parts.length) return prefix.slice(0, 2).toUpperCase();

    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  };

  const getTotalByType = (type: string) =>
    accounts
      .filter((a) => a.type === type)
      .reduce((sum, acc) => sum + getAccountValue(acc), 0);

  const getExpectedAccountValue = (acc: any) => {
    if (acc.name?.includes("Nubank")) {
      return Number(acc.expectedValue || 0);
    }

    return getAccountValue(acc);
  };

  const getExpectedTotalByType = (type: string) =>
    accounts
      .filter((a) => a.type === type)
      .reduce((sum, acc) => sum + getExpectedAccountValue(acc), 0);

  const totalCredits = getTotalByType("CREDIT");
  const totalFixed = getTotalByType("FIXED");
  const totalVariable = getTotalByType("VARIABLE");
  const saldoPrevisto =
    getExpectedTotalByType("CREDIT") -
    accounts
      .filter((a) => a.type !== "CREDIT")
      .reduce((sum, acc) => sum + getExpectedAccountValue(acc), 0);

  const clearAppState = () => {
    setMonths([]);
    setCurrentIndex(0);
    setMonthId(null);
    setAccounts([]);
    setTransactions([]);
    setShowForm(false);
    setCreateModal({ open: false, type: null });
    setShowDeleteModal(false);
    setShowCreateMonthModal(false);
    setAccountToDelete(null);
    setShowEdit(false);
    setEditAccount(null);
    setEditValue("");
    setDetailsAccount(null);
    setShowExpectedEdit(false);
    setExpectedAccount(null);
    setExpectedValue("");
    setShowUserMenu(false);
    setShowValues(false);
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
  setUser(u);

  if (!u) {
    clearAppState();
    router.push("/");
    return;
  }

  // 🔐 VALIDAÇÃO DE USUÁRIO
 if (!u.email || !ALLOWED_USERS.includes(u.email)) {
  alert("Acesso não autorizado");
  await auth.signOut();
  router.push("/");
  return;
}

  const all = await getAllMonths();

  if (all.length === 0) {
    await createMonth(2026, 1, u.uid);
  }

  const refreshed = await getAllMonths();
  setMonths(refreshed);

  if (refreshed.length > 0) {
    await loadMonth(refreshed.length - 1, refreshed);
  }
});

    return () => unsub();
  }, []);

  const loadMonth = async (index: number, list = months) => {
    const m = list[index];
    if (!m) return;

    setCurrentIndex(index);
    setMonthId(m.id);

    await loadData(m.id);
  };

  const confirmCreateNext = async () => {
    const userNow = auth.currentUser;
    if (!userNow || !months.length) return;

    const current = months[currentIndex];
    if (!current) return;

    let month = current.month + 1;
    let year = current.year;

    if (month === 13) {
      month = 1;
      year++;
    }

    await createMonth(year, month, userNow.uid);

    const all = await getAllMonths();
    setMonths(all);

    if (all.length > 0) {
      await loadMonth(all.length - 1, all);
    }

    setShowCreateMonthModal(false);
    toast.success("Novo mes criado com sucesso.");
  };

  const handleLogout = async () => {
    await auth.signOut();
    clearAppState();
    router.push("/");
  };

  const askDelete = (acc: any) => {
    if (acc.name?.includes("Nubank")) return;

    setAccountToDelete(acc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!monthId || !accountToDelete) return;

    await deleteAccount(monthId, accountToDelete.id);

    setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));

    setShowDeleteModal(false);
    setAccountToDelete(null);
    toast.success("Conta excluida com sucesso.");
  };

  const openEdit = (acc: any) => {
    if (acc.name?.includes("Nubank")) return;

    setEditAccount(acc);
    setEditValue(formatCurrencyInput(Number(acc.value || 0)));
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!monthId || !editAccount) return;

    const parsed = parseCurrency(editValue);

    await updateAccountValue(monthId, editAccount.id, parsed);

    setAccounts((prev) =>
      prev.map((a) => (a.id === editAccount.id ? { ...a, value: parsed } : a))
    );

    setShowEdit(false);
    toast.success("Valor editado com sucesso.");
  };

  const openExpectedEdit = (acc: any) => {
    setExpectedAccount(acc);
    setExpectedValue(formatCurrencyInput(Number(acc.expectedValue || 0)));
    setShowExpectedEdit(true);
  };

  const saveExpectedEdit = async () => {
    if (!monthId || !expectedAccount) return;

    const parsed = parseCurrency(expectedValue);

    await updateAccountExpectedValue(monthId, expectedAccount.id, parsed);

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === expectedAccount.id ? { ...a, expectedValue: parsed } : a
      )
    );

    setShowExpectedEdit(false);
    setExpectedAccount(null);
    setExpectedValue("");
    toast.success("Valor previsto editado com sucesso.");
  };

  const handleReorderAccounts = async (
    type: string,
    draggedId: string,
    targetId: string
  ) => {
    if (!monthId) return;

    const typeAccounts = accounts.filter((acc) => acc.type === type);
    const fromIndex = typeAccounts.findIndex((acc) => acc.id === draggedId);
    const toIndex = typeAccounts.findIndex((acc) => acc.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...typeAccounts];
    const [draggedAccount] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, draggedAccount);

    const orderedAccounts = reordered.map((acc, index) => ({
      ...acc,
      order: index,
    }));
    const orderedById = new Map(
      orderedAccounts.map((acc) => [acc.id, acc])
    );

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.type === type ? orderedById.get(acc.id) || acc : acc
      )
    );

    await updateAccountsOrder(
      monthId,
      orderedAccounts.map((acc) => ({
        id: acc.id,
        order: acc.order,
      }))
    );

    toast.success("Ordem atualizada com sucesso.");
  };

  const extratoHref = monthId ? `/extrato?monthId=${monthId}` : "/extrato";

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-6 py-6">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 text-sm">Controle financeiro</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={extratoHref}
            className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl transition"
          >
            Extrato
          </Link>

          <button
            onClick={() => setShowCreateMonthModal(true)}
            className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl"
            type="button"
          >
            Novo mês
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl shadow"
            type="button"
          >
            + Lançar
          </button>

          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-2 py-1 ml-4">
            <button
              onClick={() => currentIndex > 0 && loadMonth(currentIndex - 1)}
              className="px-3 py-1 rounded-full hover:bg-zinc-800"
              type="button"
            >
              ←
            </button>

            <span className="px-4 text-sm font-semibold text-zinc-300 min-w-[72px] text-center">
              {months[currentIndex]?.month}/{months[currentIndex]?.year}
            </span>

            <button
              onClick={() =>
                currentIndex < months.length - 1 &&
                loadMonth(currentIndex + 1)
              }
              className="px-3 py-1 rounded-full hover:bg-zinc-800"
              type="button"
            >
              →
            </button>
          </div>

          <div className="relative ml-2">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg overflow-hidden"
              type="button"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Foto do usuário"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-bold">{getInitials(user?.email)}</span>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 bg-zinc-900 rounded shadow p-2 z-50">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left"
                  type="button"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SALDO */}
      <div className="bg-purple-800 p-6 rounded-xl mb-6 flex items-center justify-between gap-6">
        <div className="flex items-stretch gap-8">
          <div>
            <h2 className="text-sm text-purple-100">Saldo real</h2>
            <p className="text-2xl font-bold text-white">
              {formatMoney(saldo)}
            </p>
          </div>

          <div className="w-px bg-purple-300/30" />

          <div>
            <h2 className="text-sm text-purple-200">Saldo previsto</h2>
            <p className="text-2xl font-bold text-purple-100">
              {formatMoney(saldoPrevisto)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowValues((prev) => !prev)}
          type="button"
          className="text-3xl leading-none opacity-90 hover:opacity-100 transition"
          aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>

      {/* COLUNAS */}
      <div className="grid grid-cols-3 gap-4">
        <AccountColumn
          title="Créditos"
          type="CREDIT"
          accounts={accounts}
          totalValue={totalCredits}
          getAccountValue={getAccountValue}
          formatMoney={formatMoney}
          onDelete={askDelete}
          onToggle={(acc) => handleTogglePaid(monthId!, acc)}
          onEdit={openEdit}
          onEditDetails={setDetailsAccount}
          onAdd={(type) => setCreateModal({ open: true, type })}
          onReorder={handleReorderAccounts}
        />

        <AccountColumn
          title="Fixas"
          type="FIXED"
          accounts={accounts}
          totalValue={totalFixed}
          getAccountValue={getAccountValue}
          formatMoney={formatMoney}
          onDelete={askDelete}
          onToggle={(acc) => handleTogglePaid(monthId!, acc)}
          onEdit={openEdit}
          onEditDetails={setDetailsAccount}
          onAdd={(type) => setCreateModal({ open: true, type })}
          onReorder={handleReorderAccounts}
        />

        <AccountColumn
          title="Variáveis"
          type="VARIABLE"
          accounts={accounts}
          totalValue={totalVariable}
          getAccountValue={getAccountValue}
          formatMoney={formatMoney}
          onDelete={askDelete}
          onToggle={(acc) => handleTogglePaid(monthId!, acc)}
          onEdit={openEdit}
          onEditDetails={setDetailsAccount}
          onAdd={(type) => setCreateModal({ open: true, type })}
          onOpenStatement={() => router.push(extratoHref)}
          onEditExpectedValue={openExpectedEdit}
          onReorder={handleReorderAccounts}
        />
      </div>

      {/* MODAL EDITAR */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-80">
            <h2 className="mb-3 text-lg font-bold">Editar valor</h2>

            <input
              value={editValue}
              onChange={(e) =>
                setEditValue(e.target.value.replace(/[^\d.,]/g, ""))
              }
              className="w-full p-2 bg-zinc-800 rounded mb-3"
              placeholder="Novo valor"
            />

            <div className="flex justify-between">
              <button
                onClick={saveEdit}
                className="bg-green-600 px-4 py-2 rounded"
                type="button"
              >
                Salvar
              </button>

              <button
                onClick={() => setShowEdit(false)}
                className="bg-red-600 px-4 py-2 rounded"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR VALOR PREVISTO */}
      {showExpectedEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">
              Editar valor previsto
            </h2>

            <p className="text-sm text-zinc-400 mb-3">
              {expectedAccount?.name}
            </p>

            <input
              value={expectedValue}
              onChange={(e) =>
                setExpectedValue(e.target.value.replace(/[^\d.,]/g, ""))
              }
              className="w-full p-2 bg-zinc-800 rounded mb-3"
              placeholder="Valor previsto"
            />

            <div className="flex justify-between">
              <button
                onClick={saveExpectedEdit}
                className="bg-green-600 px-4 py-2 rounded"
                type="button"
              >
                Salvar
              </button>

              <button
                onClick={() => {
                  setShowExpectedEdit(false);
                  setExpectedAccount(null);
                  setExpectedValue("");
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

      {/* MODAL EXCLUIR */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center">
            <h2 className="mb-4 text-lg font-bold">
              Deseja realmente excluir?
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
                  setShowDeleteModal(false);
                  setAccountToDelete(null);
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

      {/* MODAL CRIAR MES */}
      {showCreateMonthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">
              Criar novo mes?
            </h2>

            <p className="text-sm text-zinc-400 mb-5">
              Deseja realmente criar um novo mes?
            </p>

            <div className="flex justify-between">
              <button
                onClick={confirmCreateNext}
                className="bg-green-600 px-4 py-2 rounded"
                type="button"
              >
                Sim
              </button>

              <button
                onClick={() => setShowCreateMonthModal(false)}
                className="bg-red-600 px-4 py-2 rounded"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO */}
      <LaunchModal
        open={showForm}
        onClose={() => setShowForm(false)}
        monthId={monthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={setTransactions}
        onMonthsChanged={async () => {
          const refreshed = await getAllMonths();
          setMonths(refreshed);
        }}
      />

      {/* MODAL CRIAR CONTA */}
      <CreateAccountModal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false, type: null })}
        monthId={monthId}
        type={createModal.type}
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
