"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { auth } from "../../lib/auth";
import { createMonth, getAllMonths } from "../../services/monthService";
import {
  createGroupAssignment,
  deleteGroupMember,
  deleteCurrentUserAccount,
  ensureUserProfile,
  ExistingOwnerAccountError,
  getGroupMembers,
  type GroupMemberListItem,
  type UserProfile,
} from "../../services/userService";
import {
  deleteTransaction,
  updateTransaction,
} from "../../services/transactionService";
import {
  deleteAccount,
  isCalculatedAccount,
  isCreditCardAccount,
  isInstallmentAccount,
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
import { useModalKeyboardActions } from "../../hooks/useModalKeyboardActions";

const ALL_LAUNCHERS = "all";

type LauncherFilter = string;

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
  const fieldLabelClass = "mb-1 block text-xs font-semibold text-zinc-400";
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [groupId, setGroupId] = useState("");
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
  const [pixAccount, setPixAccount] = useState<FinanceAccount | null>(null);
  const [pixEditingId, setPixEditingId] = useState<string | null>(null);
  const [pixEditValue, setPixEditValue] = useState("");
  const [pixLauncherFilter, setPixLauncherFilter] =
    useState<LauncherFilter>(ALL_LAUNCHERS);
  const [pixDeletingTransaction, setPixDeletingTransaction] =
    useState<any>(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [members, setMembers] = useState<GroupMemberListItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberToDelete, setMemberToDelete] =
    useState<GroupMemberListItem | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [showMoreOptionsModal, setShowMoreOptionsModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const {
    accounts,
    setAccounts,
    transactions,
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

  const formatCurrencyTyping = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = Number(numbers) / 100;

    return amount.toLocaleString("pt-BR", {
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
    if (isCreditCardAccount(acc)) {
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
    setGroupId("");
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
    setPixAccount(null);
    setPixEditingId(null);
    setPixEditValue("");
    setPixDeletingTransaction(null);
    setShowUserMenu(false);
    setShowMembersModal(false);
    setShowAddMemberModal(false);
    setMembers([]);
    setIsLoadingMembers(false);
    setMemberName("");
    setMemberEmail("");
    setIsSavingMember(false);
    setMemberToDelete(null);
    setIsDeletingMember(false);
    setShowMoreOptionsModal(false);
    setShowDeleteAccountModal(false);
    setIsDeletingAccount(false);
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

  let profile: UserProfile;

  try {
    profile = await ensureUserProfile(u);
  } catch (error) {
    if (error instanceof ExistingOwnerAccountError) {
      toast.error(error.message);
      await auth.signOut();
      clearAppState();
      router.push("/");
      return;
    }

    throw error;
  }

  setGroupId(profile.groupId);
  setPixLauncherFilter(u.uid || ALL_LAUNCHERS);

  try {
    const groupMembers = await getGroupMembers(profile.groupId);
    setMembers(groupMembers);
  } catch (error) {
    console.error("Erro ao carregar membros:", error);
  }

  let all = await getAllMonths(profile.groupId);

  if (all.length === 0) {
    await createMonth(2026, 1, u.uid, profile.groupId);
    all = await getAllMonths(profile.groupId);
  }

  setMonths(all);

  if (all.length > 0) {
    const lastIndex = all.length - 1;
    setCurrentIndex(lastIndex);
    setMonthId(all[lastIndex].id);
    await loadData(all[lastIndex].id);
  }

  setIsCheckingAuth(false);
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
    if (!userNow || !groupId || !months.length) return;

    const current = months[currentIndex];
    if (!current) return;

    let month = current.month + 1;
    let year = current.year;

    if (month === 13) {
      month = 1;
      year++;
    }

    await createMonth(year, month, userNow.uid, groupId);

    const all = await getAllMonths(groupId);
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

  const confirmDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsDeletingAccount(true);

    try {
      const currentProfile = await ensureUserProfile(currentUser);
      await deleteCurrentUserAccount(currentProfile);
      await auth.signOut();
      clearAppState();
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

  const askDelete = (acc: any) => {
    if (isCalculatedAccount(acc)) return;

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

  const isDeletingInstallmentAccount =
    isInstallmentAccount(accountToDelete);

  const openEdit = (acc: any) => {
    if (isCalculatedAccount(acc)) return;

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

  const pixTransactions = transactions.filter(
    (transaction) => transaction.accountId === pixAccount?.id
  );
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
    const launcherId = transaction.launcherId || transaction.userId || "";

    if (member.status === "active" && launcherId && launcherId === member.id) {
      return true;
    }

    const rawLauncher = normalizeText(
      `${transaction.launcherName || ""} ${transaction.userName || ""} ${
        transaction.userEmail || ""
      }`
    );
    const memberName = normalizeText(member.name);
    const memberEmail = normalizeText(member.email);
    const memberEmailPrefix = normalizeText(member.email.split("@")[0] || "");

    return Boolean(
      rawLauncher &&
        ((memberName && rawLauncher.includes(memberName)) ||
          (memberEmail && rawLauncher.includes(memberEmail)) ||
          (memberEmailPrefix && rawLauncher.includes(memberEmailPrefix)))
    );
  };
  const pixFilteredTransactions = pixTransactions.filter((transaction) => {
    if (pixLauncherFilter === ALL_LAUNCHERS) return true;

    const selectedMember = members.find(
      (member) => member.id === pixLauncherFilter
    );

    if (selectedMember) return transactionMatchesMember(transaction, selectedMember);

    const raw = normalizeText(
      `${transaction.launcherName || ""} ${transaction.userName || ""} ${
        transaction.userEmail || ""
      }`
    );

    return raw.includes(normalizeText(pixLauncherFilter));
  });
  const pixEditingTransaction = pixTransactions.find(
    (transaction) => transaction.id === pixEditingId
  );

  const formatTransactionDate = (value: string) => {
    if (!value) return "-";

    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;

    return `${day}/${month}/${year}`;
  };

  const getTransactionLauncher = (transaction: any) => {
    return (
      transaction.launcherName ||
      transaction.userName ||
      transaction.userEmail ||
      "Sem informacao"
    );
  };

  const startPixEdit = (transaction: any) => {
    setPixEditingId(transaction.id);
    setPixEditValue(formatCurrencyInput(Number(transaction.value || 0)));
  };

  const cancelPixEdit = () => {
    setPixEditingId(null);
    setPixEditValue("");
  };

  const closePixHistory = () => {
    setPixAccount(null);
    cancelPixEdit();
    setPixDeletingTransaction(null);
  };

  const savePixTransactionValue = async () => {
    if (!monthId || !pixAccount || !pixEditingTransaction) return;

    const previousValue = Number(pixEditingTransaction.value || 0);
    const nextValue = parseCurrency(pixEditValue);
    const delta = nextValue - previousValue;
    const nextAccountValue = Number(pixAccount.value || 0) + delta;

    await updateTransaction(monthId, pixEditingTransaction.id, {
      value: nextValue,
    });

    await updateAccountValue(monthId, pixAccount.id, nextAccountValue);

    setTransactions((prev) =>
      prev.map((item) =>
        item.id === pixEditingTransaction.id
          ? { ...item, value: nextValue }
          : item
      )
    );

    setAccounts((prev) =>
      prev.map((account) =>
        account.id === pixAccount.id
          ? { ...account, value: nextAccountValue }
          : account
      )
    );

    setPixAccount((prev) =>
      prev ? { ...prev, value: nextAccountValue } : prev
    );
    cancelPixEdit();
    toast.success("Valor do PIX editado com sucesso.");
  };

  const confirmDeletePixTransaction = async () => {
    if (!monthId || !pixAccount || !pixDeletingTransaction) return;

    const deletedValue = Number(pixDeletingTransaction.value || 0);
    const nextAccountValue = Number(pixAccount.value || 0) - deletedValue;

    await deleteTransaction(monthId, pixDeletingTransaction.id);
    await updateAccountValue(monthId, pixAccount.id, nextAccountValue);

    setTransactions((prev) =>
      prev.filter((item) => item.id !== pixDeletingTransaction.id)
    );

    setAccounts((prev) =>
      prev.map((account) =>
        account.id === pixAccount.id
          ? { ...account, value: nextAccountValue }
          : account
      )
    );

    setPixAccount((prev) =>
      prev ? { ...prev, value: nextAccountValue } : prev
    );
    setPixDeletingTransaction(null);
    toast.success("PIX excluido com sucesso.");
  };

  useModalKeyboardActions({
    enabled: showMoreOptionsModal,
    onCancel: () => setShowMoreOptionsModal(false),
  });

  useModalKeyboardActions({
    enabled: showDeleteAccountModal,
    onCancel: () => {
      if (isDeletingAccount) return;
      setShowDeleteAccountModal(false);
    },
    onConfirm: confirmDeleteAccount,
    cancelDisabled: isDeletingAccount,
    confirmDisabled: isDeletingAccount,
  });

  useModalKeyboardActions({
    enabled: showMembersModal && !showAddMemberModal && !memberToDelete,
    onCancel: () => setShowMembersModal(false),
  });

  useModalKeyboardActions({
    enabled: showAddMemberModal,
    onCancel: closeAddMember,
    cancelDisabled: isSavingMember,
  });

  useModalKeyboardActions({
    enabled: Boolean(memberToDelete),
    onCancel: () => {
      if (isDeletingMember) return;
      setMemberToDelete(null);
    },
    onConfirm: confirmDeleteMember,
    cancelDisabled: isDeletingMember,
    confirmDisabled: isDeletingMember,
  });

  useModalKeyboardActions({
    enabled: showEdit,
    onCancel: () => setShowEdit(false),
  });

  useModalKeyboardActions({
    enabled: showExpectedEdit,
    onCancel: () => {
      setShowExpectedEdit(false);
      setExpectedAccount(null);
      setExpectedValue("");
    },
  });

  useModalKeyboardActions({
    enabled: showDeleteModal,
    onCancel: () => {
      setShowDeleteModal(false);
      setAccountToDelete(null);
    },
    onConfirm: confirmDelete,
  });

  useModalKeyboardActions({
    enabled: showCreateMonthModal,
    onCancel: () => setShowCreateMonthModal(false),
    onConfirm: confirmCreateNext,
  });

  useModalKeyboardActions({
    enabled:
      Boolean(pixAccount) &&
      !pixEditingTransaction &&
      !pixDeletingTransaction,
    onCancel: closePixHistory,
  });

  useModalKeyboardActions({
    enabled: Boolean(pixEditingTransaction),
    onCancel: cancelPixEdit,
  });

  useModalKeyboardActions({
    enabled: Boolean(pixDeletingTransaction),
    onCancel: () => setPixDeletingTransaction(null),
    onConfirm: confirmDeletePixTransaction,
  });

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
  const openCreditCardStatement = (acc: FinanceAccount) => {
    const params = new URLSearchParams();

    if (monthId) {
      params.set("monthId", monthId);
    }

    params.set("creditCardId", acc.id);

    router.push(`/extrato?${params.toString()}`);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black" />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-6">
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
                  onClick={openMembers}
                  className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left"
                  type="button"
                >
                  Membros
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowMoreOptionsModal(true);
                  }}
                  className="px-4 py-2 hover:bg-zinc-800 rounded w-full text-left"
                  type="button"
                >
                  Mais opções
                </button>

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

      {showMoreOptionsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold">Mais opções</h2>

              <button
                onClick={() => setShowMoreOptionsModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
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

      {showMembersModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold">Membros</h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={openAddMember}
                  className="bg-purple-600 hover:bg-purple-700 p-2 rounded"
                  type="button"
                  title="Cadastrar membro"
                  aria-label="Cadastrar membro"
                >
                  <Plus size={18} />
                </button>

                <button
                  onClick={() => setShowMembersModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded"
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>

            {isLoadingMembers ? (
              <div className="text-zinc-400">Carregando...</div>
            ) : members.length === 0 ? (
              <div className="text-zinc-400">Nenhum membro encontrado.</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">
                        {member.name || member.email.split("@")[0]}
                      </div>

                      <div className="flex items-center gap-2">
                        {member.role === "admin" && (
                          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-100 border border-purple-400/20">
                            Admin
                          </span>
                        )}

                        {member.status === "pending" && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200 border border-amber-400/20">
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

                    <div className="text-sm text-zinc-400 break-words">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6">
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
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none"
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 outline-none"
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="submit"
              >
                {isSavingMember ? "Salvando..." : "Salvar"}
              </button>

              <button
                onClick={closeAddMember}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingMember}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

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
      <div className="grid grid-cols-3 items-start gap-4">
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
          onOpenStatement={openCreditCardStatement}
          onOpenPixHistory={setPixAccount}
          onEditExpectedValue={openExpectedEdit}
          onReorder={handleReorderAccounts}
        />
      </div>

      {/* MODAL EDITAR */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-80"
            onSubmit={(event) => {
              event.preventDefault();
              saveEdit();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">Editar valor</h2>

            <label className="block mb-3">
              <span className={fieldLabelClass}>Novo valor</span>
              <input
                type="tel"
                inputMode="decimal"
                value={editValue}
                onChange={(e) =>
                  setEditValue(formatCurrencyTyping(e.target.value))
                }
                className="w-full p-2 bg-zinc-800 rounded"
                placeholder="Novo valor"
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="submit"
              >
                Salvar
              </button>

              <button
                onClick={() => setShowEdit(false)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDITAR VALOR PREVISTO */}
      {showExpectedEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              saveExpectedEdit();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">
              Editar valor previsto
            </h2>

            <p className="text-sm text-zinc-400 mb-3">
              {expectedAccount?.name}
            </p>

            <label className="block mb-3">
              <span className={fieldLabelClass}>Valor previsto</span>
              <input
                type="tel"
                inputMode="decimal"
                value={expectedValue}
                onChange={(e) =>
                  setExpectedValue(formatCurrencyTyping(e.target.value))
                }
                className="w-full p-2 bg-zinc-800 rounded"
                placeholder="Valor previsto"
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="submit"
              >
                Salvar
              </button>

              <button
                onClick={() => {
                  setShowExpectedEdit(false);
                  setExpectedAccount(null);
                  setExpectedValue("");
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center">
            <h2 className="mb-4 text-lg font-bold">
              {isDeletingInstallmentAccount
                ? "Excluir conta parcelada?"
                : "Deseja realmente excluir?"}
            </h2>

            {isDeletingInstallmentAccount && (
              <p className="mb-5 text-sm text-zinc-400">
                Esta conta e as próximas parcelas dela serão removidas dos meses
                futuros. Parcelas de meses anteriores serão mantidas no
                histórico.
              </p>
            )}

            <div className="flex justify-between gap-2">
              <button
                onClick={confirmDelete}
                className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded font-semibold transition"
                type="button"
                autoFocus
              >
                Sim
              </button>

              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setAccountToDelete(null);
                }}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
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

            <div className="flex justify-between gap-2">
              <button
                onClick={confirmCreateNext}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="button"
                autoFocus
              >
                Sim
              </button>

              <button
                onClick={() => setShowCreateMonthModal(false)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LANÇAMENTO */}
      {/* MODAL HISTORICO PIX */}
      {pixAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-2xl border border-zinc-800">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold">Historico PIX</h2>
                <p className="text-sm text-zinc-400">
                  Total: {formatMoney(Number(pixAccount.value || 0))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={pixLauncherFilter}
                  onChange={(event) =>
                    setPixLauncherFilter(event.target.value as LauncherFilter)
                  }
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 outline-none"
                >
                  <option value={ALL_LAUNCHERS}>Todos</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {getMemberLabel(member)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={closePixHistory}
                  className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>

            {pixFilteredTransactions.length === 0 ? (
              <div className="bg-zinc-800/70 rounded-lg p-4 text-zinc-400">
                Nenhum lancamento PIX encontrado neste mes.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                {pixFilteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[110px_1fr_auto_auto] gap-3 items-center">
                      <div className="font-semibold">
                        {formatTransactionDate(transaction.date)}
                      </div>

                      <div className="text-zinc-300 break-words">
                        <span className="font-semibold text-zinc-200">
                          {getTransactionLauncher(transaction)}
                        </span>
                        {` - ${transaction.note || "-"}`}
                      </div>

                      <button
                        onClick={() => startPixEdit(transaction)}
                        className="font-bold hover:underline md:text-right"
                        type="button"
                      >
                        {formatMoney(Number(transaction.value || 0))}
                      </button>

                      <button
                        onClick={() => setPixDeletingTransaction(transaction)}
                        className="p-1 text-zinc-500 hover:text-red-300 transition justify-self-start md:justify-self-end"
                        type="button"
                        title="Excluir PIX"
                        aria-label="Excluir PIX"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDITAR PIX */}
      {pixEditingTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-80 border border-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              savePixTransactionValue();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">Editar PIX</h2>

            <p className="text-sm text-zinc-400 mb-3">
              {formatTransactionDate(pixEditingTransaction.date)} -{" "}
              {getTransactionLauncher(pixEditingTransaction)}
            </p>

            <label className="block mb-3">
              <span className={fieldLabelClass}>Novo valor</span>
              <input
                type="tel"
                inputMode="decimal"
                value={pixEditValue}
                onChange={(event) =>
                  setPixEditValue(formatCurrencyTyping(event.target.value))
                }
                className="w-full p-2 bg-zinc-800 rounded"
                placeholder="Novo valor"
                autoFocus
              />
            </label>

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition"
                type="submit"
              >
                Salvar
              </button>

              <button
                onClick={cancelPixEdit}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EXCLUIR PIX */}
      {pixDeletingTransaction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-3 text-lg font-bold">Excluir PIX?</h2>

            <p className="text-sm text-zinc-400 mb-5">
              Deseja realmente excluir este PIX?
            </p>

            <div className="flex justify-between gap-2">
              <button
                onClick={confirmDeletePixTransaction}
                className="bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded font-semibold transition"
                type="button"
                autoFocus
              >
                Sim
              </button>

              <button
                onClick={() => setPixDeletingTransaction(null)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded font-semibold transition"
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <LaunchModal
        open={showForm}
        onClose={() => setShowForm(false)}
        monthId={monthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={setTransactions}
        onMonthsChanged={async () => {
          if (!groupId) return;
          const refreshed = await getAllMonths(groupId);
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
        accounts={accounts}
        setAccounts={setAccounts}
      />
    </div>
  );
}
