"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Menu,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { auth } from "../../lib/auth";
import { getAllMonths } from "../../services/monthService";
import {
  createGroupAssignment,
  deleteGroupMember,
  deleteCurrentUserAccount,
  ensureUserProfile,
  ExistingOwnerAccountError,
  getGroupMembers,
  type GroupMemberListItem,
} from "../../services/userService";

import {
  getTransactions,
  updateTransaction,
  deleteTransaction,
} from "../../services/transactionService";
import {
  anticipateInstallmentPurchase,
  cancelInstallmentPurchaseFromInstallment,
} from "../../services/installmentPurchaseService";

import {
  formatAccountNameWithDueDay,
  getAccountsByMonth,
  isCreditCardAccount,
} from "../../services/accountService";

import type { FinanceAccount } from "../../services/accountService";

import LaunchModal from "../../components/LaunchModal";
import EditAccountModal from "../../components/EditAccountModal";
import SwitchControl from "../../components/SwitchControl";

const ALL_LAUNCHERS = "all";

type LauncherFilter = string;

export default function MobileDashboard() {
  const router = useRouter();
  const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";

  const [user, setUser] =
    useState<any>(null);

  const [months, setMonths] = useState<any[]>([]);
  const [groupId, setGroupId] = useState("");
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

  const [
    showUserMenu,
    setShowUserMenu,
  ] = useState(false);

  const [
    showMembersModal,
    setShowMembersModal,
  ] = useState(false);

  const [members, setMembers] =
    useState<GroupMemberListItem[]>([]);

  const [
    isLoadingMembers,
    setIsLoadingMembers,
  ] = useState(false);

  const [
    showAddMemberModal,
    setShowAddMemberModal,
  ] = useState(false);

  const [memberName, setMemberName] =
    useState("");

  const [memberEmail, setMemberEmail] =
    useState("");

  const [
    isSavingMember,
    setIsSavingMember,
  ] = useState(false);

  const [
    memberToDelete,
    setMemberToDelete,
  ] = useState<GroupMemberListItem | null>(null);

  const [
    isDeletingMember,
    setIsDeletingMember,
  ] = useState(false);

  const [
    showMoreOptionsModal,
    setShowMoreOptionsModal,
  ] = useState(false);

  const [
    showDeleteAccountModal,
    setShowDeleteAccountModal,
  ] = useState(false);

  const [
    isDeletingAccount,
    setIsDeletingAccount,
  ] = useState(false);

  const [showValues, setShowValues] =
    useState(false);

  const [launcherFilter, setLauncherFilter] =
    useState<LauncherFilter>(ALL_LAUNCHERS);

  // 🔥 edição rápida
  const [editTransaction, setEditTransaction] =
    useState<any | null>(null);

  const [editValue, setEditValue] =
    useState("");

  const [
    anticipateInstallments,
    setAnticipateInstallments,
  ] = useState(false);

  const [
    anticipationInstallments,
    setAnticipationInstallments,
  ] = useState("");

  const [
    anticipationPaidValue,
    setAnticipationPaidValue,
  ] = useState("");

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

  const getInitials = (email?: string | null) => {
    if (!email) return "?";

    const prefix = email.split("@")[0];
    const parts = prefix.split(/[._-]/g).filter(Boolean);

    if (!parts.length) return prefix.slice(0, 2).toUpperCase();

    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  };

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

    return String(raw)
      .split("@")[0]
      .split(" ")[0];
  };

  const normalizeText = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const getMemberLabel = (member: GroupMemberListItem) =>
    member.name || member.email.split("@")[0] || "Sem nome";

  const transactionMatchesMember = (
    transaction: any,
    member: GroupMemberListItem
  ) => {
    const launcherId =
      transaction.launcherId ||
      transaction.userId ||
      "";

    if (
      member.status === "active" &&
      launcherId &&
      launcherId === member.id
    ) {
      return true;
    }

    const rawLauncher = normalizeText(
      `${transaction.launcherName || ""} ${transaction.userName || ""}`
    );
    const memberName = normalizeText(member.name);
    const memberEmail = normalizeText(member.email);
    const memberEmailPrefix = normalizeText(
      member.email.split("@")[0] || ""
    );

    return Boolean(
      rawLauncher &&
        ((memberName && rawLauncher.includes(memberName)) ||
          (memberEmail && rawLauncher.includes(memberEmail)) ||
          (memberEmailPrefix && rawLauncher.includes(memberEmailPrefix)))
    );
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

  const stripInstallmentSuffix = (value: string) =>
    String(value || "")
      .replace(/\s*\(\d+\/\d+\)\s*$/, "")
      .replace(/\s-\s\d+\/\d+\s*$/, "")
      .trim();

  const closeEditTransaction = () => {
    setEditTransaction(null);
    setEditValue("");
    setAnticipateInstallments(false);
    setAnticipationInstallments("");
    setAnticipationPaidValue("");
  };

  const handleLogout = async () => {
    await auth.signOut();
    setShowUserMenu(false);
    setShowMembersModal(false);
    setShowAddMemberModal(false);
    setShowMoreOptionsModal(false);
    setShowDeleteAccountModal(false);
    router.push("/");
  };

  const confirmDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsDeletingAccount(true);

    try {
      const currentProfile = await ensureUserProfile(currentUser);
      await deleteCurrentUserAccount(currentProfile);
      await auth.signOut();
      router.push("/");
      toast.success("Conta excluida com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast.error("Nao foi possivel excluir a conta.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openMembers = async () => {
    if (!groupId) return;

    setShowUserMenu(false);
    setShowMembersModal(true);
    setIsLoadingMembers(true);

    try {
      const groupMembers = await getGroupMembers(groupId);
      setMembers(groupMembers);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
      toast.error("Nao foi possivel carregar os membros.");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const openAddMember = () => {
    setMemberName("");
    setMemberEmail("");
    setShowAddMemberModal(true);
  };

  const closeAddMember = () => {
    if (isSavingMember) return;

    setMemberName("");
    setMemberEmail("");
    setShowAddMemberModal(false);
  };

  const saveMember = async () => {
    const currentUser = auth.currentUser;
    const normalizedName = memberName.trim();
    const normalizedEmail = memberEmail.trim().toLowerCase();

    if (!groupId || !currentUser) return;

    if (!normalizedName) {
      toast.error("Informe o nome do membro.");
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      toast.error("Informe um e-mail valido.");
      return;
    }

    setIsSavingMember(true);

    try {
      await createGroupAssignment(
        normalizedName,
        normalizedEmail,
        groupId,
        currentUser.uid
      );

      const groupMembers = await getGroupMembers(groupId);
      setMembers(groupMembers);
      setMemberName("");
      setMemberEmail("");
      setShowAddMemberModal(false);
      toast.success("Membro cadastrado com sucesso.");
    } catch (error) {
      console.error("Erro ao cadastrar membro:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel cadastrar o membro."
      );
    } finally {
      setIsSavingMember(false);
    }
  };

  const canDeleteMembers =
    members.some(
      (member) => member.id === auth.currentUser?.uid && member.role === "admin"
    );

  const confirmDeleteMember = async () => {
    if (!memberToDelete || !groupId) return;

    setIsDeletingMember(true);

    try {
      await deleteGroupMember(memberToDelete);
      const groupMembers = await getGroupMembers(groupId);
      setMembers(groupMembers);
      setMemberToDelete(null);
      toast.success("Membro removido com sucesso.");
    } catch (error) {
      console.error("Erro ao remover membro:", error);
      toast.error("Nao foi possivel remover o membro.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  const editRemainingInstallments =
    editTransaction?.installmentTotal && editTransaction?.installmentCurrent
      ? Math.max(
          Number(editTransaction.installmentTotal) -
            Number(editTransaction.installmentCurrent),
          0
        )
      : 0;
  const parsedAnticipationInstallments = anticipationInstallments
    ? Number(anticipationInstallments)
    : 0;
  const anticipationOriginalAmount =
    editTransaction && parsedAnticipationInstallments > 0
      ? Number(editTransaction.value || 0) * parsedAnticipationInstallments
      : 0;
  const anticipationPaidAmount = parseCurrency(anticipationPaidValue);
  const anticipationDiscountAmount = Math.max(
    anticipationOriginalAmount - anticipationPaidAmount,
    0
  );
  const canAnticipateEditTransaction =
    Boolean(editTransaction?.installmentGroupId) && editRemainingInstallments > 0;

  const saveEditTransaction = async () => {
    if (!monthId || !editTransaction) return;

    const parsedValue = parseCurrency(editValue);

    if (Number.isNaN(parsedValue)) {
      toast.error("Informe um valor valido.");
      return;
    }

    if (anticipateInstallments) {
      if (!groupId || !editTransaction.accountId || !editTransaction.installmentGroupId) {
        toast.error("Nao foi possivel identificar a compra parcelada.");
        return;
      }

      if (
        !Number.isInteger(parsedAnticipationInstallments) ||
        parsedAnticipationInstallments < 1 ||
        parsedAnticipationInstallments > editRemainingInstallments
      ) {
        toast.error("Informe uma quantidade valida de parcelas para antecipar.");
        return;
      }

      if (
        !Number.isFinite(anticipationPaidAmount) ||
        anticipationPaidAmount <= 0
      ) {
        toast.error("Informe o valor cobrado pelo banco.");
        return;
      }

      if (anticipationPaidAmount > anticipationOriginalAmount) {
        toast.error("O valor cobrado nao pode ser maior que o valor original.");
        return;
      }
    }

    try {
      await updateTransaction(monthId, editTransaction.id, {
        value: parsedValue,
      });

      if (anticipateInstallments) {
        const userId =
          editTransaction.launcherId ||
          editTransaction.userId ||
          auth.currentUser?.uid ||
          "";
        const userName =
          editTransaction.launcherName ||
          editTransaction.userName ||
          auth.currentUser?.displayName ||
          auth.currentUser?.email ||
          "";

        await anticipateInstallmentPurchase({
          groupId,
          currentMonthId: monthId,
          installmentGroupId: String(editTransaction.installmentGroupId),
          currentInstallment: Number(editTransaction.installmentCurrent || 1),
          installmentsToAnticipate: parsedAnticipationInstallments,
          originalAmount: anticipationOriginalAmount,
          paidAmount: anticipationPaidAmount,
          discountAmount: anticipationDiscountAmount,
          accountId: String(editTransaction.accountId),
          category: editTransaction.category || "Sem categoria",
          baseNote: stripInstallmentSuffix(
            editTransaction.note || editTransaction.category || ""
          ),
          date: editTransaction.date || new Date().toISOString().slice(0, 10),
          userId,
          userName,
          launcherId: userId,
          launcherName: userName,
        });
      }

      const refreshed = await getTransactions(monthId);
      setTransactions(refreshed);
      closeEditTransaction();
      toast.success(
        anticipateInstallments
          ? "Antecipação registrada com sucesso."
          : "Lançamento editado com sucesso."
      );
    } catch (error) {
      console.error("Erro ao editar lançamento mobile:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel editar o lançamento."
      );
    }
  };

  const isDeletingInstallmentTransaction =
    Boolean(deleteTransactionData?.installmentGroupId) &&
    Boolean(deleteTransactionData?.installmentCurrent);

  const confirmDeleteTransaction = async () => {
    if (!monthId || !deleteTransactionData) return;

    try {
      if (
        groupId &&
        deleteTransactionData.installmentGroupId &&
        deleteTransactionData.installmentCurrent
      ) {
        await cancelInstallmentPurchaseFromInstallment({
          groupId,
          currentMonthId: monthId,
          installmentGroupId: String(deleteTransactionData.installmentGroupId),
          currentInstallment: Number(deleteTransactionData.installmentCurrent),
        });
      } else {
        await deleteTransaction(monthId, deleteTransactionData.id);
      }

      const refreshed = await getTransactions(monthId);
      setTransactions(refreshed);
      setDeleteTransactionData(null);
      toast.success("Lançamento excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir lançamento mobile:", error);
      toast.error("Nao foi possivel excluir o lançamento.");
    }
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

      setUser(user);

      setLauncherFilter(user.uid || ALL_LAUNCHERS);

      setShowAccountMenu(true);

      let profile;

      try {
        profile = await ensureUserProfile(user);
      } catch (error) {
        if (error instanceof ExistingOwnerAccountError) {
          toast.error(error.message);
          await auth.signOut();
          router.push("/");
          return;
        }

        console.error("Erro ao carregar perfil mobile:", error);
        toast.error("Nao foi possivel carregar seu perfil.");
        await auth.signOut();
        router.push("/");
        return;
      }

      setGroupId(profile.groupId);

      const [all, groupMembers] =
        await Promise.all([
          getAllMonths(profile.groupId),
          getGroupMembers(profile.groupId),
        ]);

      setMembers(groupMembers);

      if (
        !all ||
        all.length === 0
      ) {
        return;
      }

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

    if (!isCreditCardAccount(acc)) {
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
    accounts.find(
      (a) =>
        isCreditCardAccount(a) &&
        a.isPrimaryCreditCard === true
    ) ||
    accounts.find((a) =>
      isCreditCardAccount(a)
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

      if (launcherFilter === ALL_LAUNCHERS)
        return true;

      const member = members.find(
        (item) => item.id === launcherFilter
      );

      if (member) {
        return transactionMatchesMember(transaction, member);
      }

      return launcherName.toLowerCase() === launcherFilter.toLowerCase();
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

        <div className="absolute right-0">
          <button
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shadow-lg overflow-hidden border border-purple-400/20"
            type="button"
            aria-label="Abrir menu do usuario"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Foto do usuario"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-bold text-sm">
                {getInitials(user?.email)}
              </span>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 min-w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 z-50">
              <button
                onClick={openMembers}
                className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm"
                type="button"
              >
                Membros
              </button>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setShowMoreOptionsModal(true);
                }}
                className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm"
                type="button"
              >
                Mais opções
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 hover:bg-zinc-800 rounded-lg w-full text-left text-sm"
                type="button"
              >
                Sair
              </button>
            </div>
          )}
        </div>

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

      {showMoreOptionsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Mais opções</h2>

              <button
                onClick={() => setShowMoreOptionsModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm"
                type="button"
              >
                Fechar
              </button>
            </div>

            <button
              onClick={() => {
                setShowMoreOptionsModal(false);
                setShowDeleteAccountModal(true);
              }}
              className="w-full bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
              type="button"
            >
              Excluir conta
            </button>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-3">Excluir conta permanentemente</h2>

            <p className="text-sm text-zinc-400">
              Esta ação excluirá permanentemente sua conta do sistema financeiro.
              Se você for administrador de um grupo, todos os dados desse grupo
              serão apagados, incluindo meses, contas, lançamentos, categorias,
              convites e membros. Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={confirmDeleteAccount}
                disabled={isDeletingAccount}
                type="button"
                autoFocus
              >
                {isDeletingAccount ? "Excluindo..." : "Excluir conta"}
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => {
                  if (isDeletingAccount) return;
                  setShowDeleteAccountModal(false);
                }}
                disabled={isDeletingAccount}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARTAO DE CREDITO PRINCIPAL */}
      <div className="bg-purple-600 p-5 rounded-2xl">

        <div className="flex justify-between items-center">

          <p
            className="text-sm opacity-80"
            onClick={() => {
              if (
                cartaoAccount &&
                !isCreditCardAccount(
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
              : "Cartão de crédito principal"}
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
            <option value={ALL_LAUNCHERS}>
              Todos
            </option>

            {members.map((member) => (
              <option
                key={member.id}
                value={member.id}
              >
                {getMemberLabel(member)}
              </option>
            ))}
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
                              setAnticipateInstallments(false);
                              setAnticipationInstallments("");
                              setAnticipationPaidValue("");
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

          <div className="bg-zinc-900 p-5 rounded-2xl w-full max-w-sm border border-zinc-800">

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

            {canAnticipateEditTransaction && (
              <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
                <SwitchControl
                  checked={anticipateInstallments}
                  label="Antecipar parcelas"
                  onChange={(checked) => {
                    setAnticipateInstallments(checked);

                    if (checked) {
                      setAnticipationInstallments(
                        editRemainingInstallments
                          ? String(editRemainingInstallments)
                          : ""
                      );
                      setAnticipationPaidValue("");
                    } else {
                      setAnticipationInstallments("");
                      setAnticipationPaidValue("");
                    }
                  }}
                />

                {anticipateInstallments && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
                      <label className="rounded-xl bg-zinc-800/70 p-3">
                        <span className="block">Antecipar</span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={anticipationInstallments}
                          onChange={(event) => {
                            const nextValue = event.target.value.replace(
                              /\D/g,
                              ""
                            );

                            if (!nextValue) {
                              setAnticipationInstallments("");
                              return;
                            }

                            setAnticipationInstallments(
                              String(
                                Math.min(
                                  Number(nextValue),
                                  editRemainingInstallments
                                )
                              )
                            );
                          }}
                          className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-purple-300 outline-none"
                          placeholder="0"
                        />
                      </label>

                      <div className="rounded-xl bg-zinc-800/70 p-3">
                        <div>Atual</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {editTransaction.installmentCurrent}/
                          {editTransaction.installmentTotal}
                        </div>
                      </div>

                      <div className="rounded-xl bg-zinc-800/70 p-3">
                        <div>Restantes</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {editRemainingInstallments}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-zinc-400">
                      <label className="rounded-xl bg-zinc-800/70 p-3">
                        <span className="block">Valor pago</span>
                        <input
                          type="tel"
                          inputMode="decimal"
                          value={anticipationPaidValue}
                          onChange={(event) =>
                            setAnticipationPaidValue(
                              formatCurrencyInput(event.target.value)
                            )
                          }
                          className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-zinc-100 outline-none"
                          placeholder="R$ 0,00"
                        />
                      </label>

                      <div className="rounded-xl bg-zinc-800/70 p-3">
                        <div>Original</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {formatMoney(anticipationOriginalAmount)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-zinc-800/70 p-3">
                        <div>Desconto</div>
                        <div className="mt-1 text-sm font-semibold text-emerald-300">
                          {formatMoney(anticipationDiscountAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-4">

              <button
                className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold transition"
                onClick={saveEditTransaction}
                type="button"
              >
                Salvar
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition"
                onClick={() => {
                  closeEditTransaction();
                }}
                type="button"
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
              {isDeletingInstallmentTransaction
                ? "Excluir compra parcelada?"
                : "Excluir lançamento"}
            </h2>

            <p className="text-sm text-zinc-400">
              {isDeletingInstallmentTransaction
                ? "Este lançamento e as próximas parcelas desta compra serão removidos. Parcelas de meses anteriores serão mantidas no histórico."
                : "Deseja realmente excluir este lançamento?"}
            </p>

            <div className="flex gap-2 mt-5">

              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition"
                onClick={confirmDeleteTransaction}
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

      {showMembersModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Membros</h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={openAddMember}
                  className="bg-purple-600 hover:bg-purple-700 p-2 rounded-lg"
                  type="button"
                  title="Cadastrar membro"
                  aria-label="Cadastrar membro"
                >
                  <Plus size={18} />
                </button>

                <button
                  onClick={() => setShowMembersModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm"
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>

            {isLoadingMembers ? (
              <div className="text-sm text-zinc-400">Carregando...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-zinc-400">
                Nenhum membro encontrado.
              </div>
            ) : (
              <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-zinc-800/70 border border-zinc-700 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 font-semibold truncate">
                        {member.name || member.email.split("@")[0]}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {member.role === "admin" && (
                          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-100 border border-purple-400/20">
                            Admin
                          </span>
                        )}

                        {member.status === "pending" && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 border border-amber-400/20">
                            Pendente
                          </span>
                        )}

                        {canDeleteMembers && member.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => setMemberToDelete(member)}
                            className="p-1 text-zinc-500 hover:text-red-300 transition"
                            title="Remover membro"
                            aria-label={`Remover membro ${
                              member.name || member.email
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-zinc-400 break-words mt-1">
                      {member.email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {memberToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-2">Remover membro</h2>

            <p className="text-sm text-zinc-400">
              Deseja remover{" "}
              {memberToDelete.name || memberToDelete.email.split("@")[0]} do
              grupo?
            </p>

            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={confirmDeleteMember}
                disabled={isDeletingMember}
                type="button"
                autoFocus
              >
                {isDeletingMember ? "Removendo..." : "Remover"}
              </button>

              <button
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => {
                  if (isDeletingMember) return;
                  setMemberToDelete(null);
                }}
                disabled={isDeletingMember}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <form
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5"
            onSubmit={(event) => {
              event.preventDefault();
              saveMember();
            }}
          >
            <h2 className="text-lg font-bold mb-4">Cadastrar membro</h2>

            <label className="block mb-3">
              <span className={fieldLabelClass}>Nome</span>
              <input
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="Nome"
                disabled={isSavingMember}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 outline-none"
                autoFocus
              />
            </label>

            <label className="block mb-4">
              <span className={fieldLabelClass}>E-mail</span>
              <input
                type="email"
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
                placeholder="email@exemplo.com"
                disabled={isSavingMember}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 outline-none"
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="submit"
              >
                {isSavingMember ? "Salvando..." : "Salvar"}
              </button>

              <button
                onClick={closeAddMember}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
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
            groupId
              ? await getAllMonths(groupId)
              : [];

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
        accounts={accounts}
        setAccounts={setAccounts}
      />

    </div>
  );
}
