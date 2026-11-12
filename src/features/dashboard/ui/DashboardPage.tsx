"use client";

import { useValueVisibility } from "../../../hooks/useValueVisibility";
import { calculateDashboardRealBalance } from "../../../domain/finance/accountBalance";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCurrentWebUser, observeWebUser, signOutWebUser } from "../../auth/application/webSession";
import type { GroupMemberListItem } from "../../../domain/finance/groupMember";
import {
  isCalculatedAccount,
  isCreditCardAccount,
  isInstallmentAccount,
  type FinanceAccount,
} from "../../../domain/finance/account";

import LaunchModal from "../../transaction-entry/ui/LaunchModal";
import CreateAccountModal from "../../accounts/ui/CreateAccountModal";
import EditAccountModal from "../../accounts/ui/EditAccountModal";
import { useDashboardFinance } from "./hooks/useDashboardFinance";
import type { FinanceTransaction } from "../../../domain/finance/transaction";
import type { FinanceMonth } from "../../../domain/finance/month";
import DashboardHeader from "./components/DashboardHeader";
import DashboardFinanceArea from "./components/DashboardFinanceArea";
import DashboardAccountDialogs from "./components/DashboardAccountDialogs";
import DashboardPixDialogs from "./components/DashboardPixDialogs";
import DashboardProfileDialogs from "./components/DashboardProfileDialogs";
import DashboardOverview, { type DashboardArea } from "./components/DashboardOverview";
import InvestorSettingsPanel from "./components/InvestorSettingsPanel";
import FinancialGoalsPanel from "./components/FinancialGoalsPanel";
import { useModalKeyboardActions } from "../../../hooks/useModalKeyboardActions";
import { getDashboardAverageBalance } from "../application/getDashboardAverageBalance";
import { getDashboardMonths } from "../application/getDashboardMonths";
import {
  createNextDashboardMonth,
  removeDashboardAccount,
  reloadDashboardMonths,
  saveDashboardAccountOrder,
  saveDashboardAccountValue,
  saveDashboardExpectedAccountValue,
} from "../application/dashboardAccountCommands";
import {
  inviteDashboardMember,
  loadDashboardMembers,
  removeDashboardMember,
} from "../application/dashboardMembers";
import {
  removeDashboardPixTransaction,
  updateDashboardPixTransaction,
} from "../application/dashboardPix";
import {
  deleteDashboardUserAccount,
  ExistingOwnerAccountError,
  loadDashboardProfile,
  switchDashboardSpace,
  type UserProfile,
} from "../application/dashboardProfile";

const ALL_LAUNCHERS = "all";

type LauncherFilter = string;

export default function DashboardPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [groupId, setGroupId] = useState("");
  const [showValues, setShowValues] = useValueVisibility();
  const [showPaymentSchedule, setShowPaymentSchedule] = useState(false);
  const [activeDashboardPage, setActiveDashboardPage] = useState<DashboardArea>("finances");

  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [saldoMedioState, setSaldoMedioState] = useState<{ groupId: string; value: number | null }>({ groupId: "", value: null });
  const saldoMedio = saldoMedioState.groupId === groupId ? saldoMedioState.value : null;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [monthId, setMonthId] = useState<string | null>(null);
  const [investorCashOutflow, setInvestorCashOutflow] = useState({ scope: "", amountCents: 0 });
  const [goalMonthlyPlan, setGoalMonthlyPlan] = useState({ scope: "", amountCents: 0 });

  const [showForm, setShowForm] = useState(false);
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    type: string | null;
  }>({
    open: false,
    type: null,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<FinanceAccount | null>(null);
  const [showCreateMonthModal, setShowCreateMonthModal] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState<FinanceAccount | null>(null);
  const [editValue, setEditValue] = useState("");
  const [detailsAccount, setDetailsAccount] = useState<FinanceAccount | null>(null);
  const [showExpectedEdit, setShowExpectedEdit] = useState(false);
  const [expectedAccount, setExpectedAccount] = useState<FinanceAccount | null>(null);
  const [expectedValue, setExpectedValue] = useState("");
  const [pixAccount, setPixAccount] = useState<FinanceAccount | null>(null);
  const [pixEditingId, setPixEditingId] = useState<string | null>(null);
  const [pixEditValue, setPixEditValue] = useState("");
  const [pixLauncherFilter, setPixLauncherFilter] =
    useState<LauncherFilter>(ALL_LAUNCHERS);
  const [pixDeletingTransaction, setPixDeletingTransaction] =
    useState<FinanceTransaction | null>(null);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeSpace, setActiveSpaceState] = useState<"family" | "personal">("family");
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
  } = useDashboardFinance();

  useEffect(() => {
    if (!groupId) {
      return;
    }
    let active = true;
    void getDashboardAverageBalance(groupId).then((balance) => {
      if (active) setSaldoMedioState({ groupId, value: balance });
    }).catch((error: unknown) => {
      console.error("Erro ao carregar os dados do saldo médio:", error);
      if (active) setSaldoMedioState({ groupId, value: null });
    });
    return () => { active = false; };
  }, [groupId]);

  const investorCashScope = `${groupId}:${monthId || ""}`;
  const selectedMonthInvestorCashOutflowCents = investorCashOutflow.scope === investorCashScope
    ? investorCashOutflow.amountCents
    : 0;
  const selectedMonthInvestorCashOutflow = selectedMonthInvestorCashOutflowCents / 100;
  const updateInvestorCashOutflow = useCallback((amountCents: number) => {
    setInvestorCashOutflow({ scope: investorCashScope, amountCents });
  }, [investorCashScope]);
  const selectedMonthGoalPlanCents = goalMonthlyPlan.scope === investorCashScope
    ? goalMonthlyPlan.amountCents
    : 0;
  const selectedMonthGoalPlan = selectedMonthGoalPlanCents / 100;
  const updateGoalMonthlyPlan = useCallback((amountCents: number) => {
    setGoalMonthlyPlan({ scope: investorCashScope, amountCents });
  }, [investorCashScope]);

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

  const getExpectedAccountValue = (acc: FinanceAccount) => {
    if (isCreditCardAccount(acc)) {
      return Number(acc.expectedValue || 0);
    }

    return getAccountValue(acc);
  };

  const getExpectedTotalByType = (type: string) =>
    accounts
      .filter((a) => a.type === type)
      .reduce((sum, acc) => sum + getExpectedAccountValue(acc), 0);

  const saldoPrevisto =
    getExpectedTotalByType("CREDIT") -
    accounts
      .filter((a) => a.type !== "CREDIT")
      .reduce((sum, acc) => sum + getExpectedAccountValue(acc), 0) -
    selectedMonthInvestorCashOutflow - selectedMonthGoalPlan;
  const saldoReal = calculateDashboardRealBalance(
    saldo,
    selectedMonthInvestorCashOutflowCents,
    selectedMonthGoalPlanCents,
  );

  const clearAppState = useCallback(() => {
    setMonths([]);
    setGroupId("");
    setCurrentIndex(0);
    setMonthId(null);
    setInvestorCashOutflow({ scope: "", amountCents: 0 });
    setGoalMonthlyPlan({ scope: "", amountCents: 0 });
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
  }, [setAccounts, setShowValues, setTransactions]);

  useEffect(() => {
    const unsub = observeWebUser(async (u) => {
  setUser(u);

  if (!u) {
    clearAppState();
    router.push("/");
    return;
  }

  let profile: UserProfile;

  try {
    profile = await loadDashboardProfile(u);
  } catch (error) {
    if (error instanceof ExistingOwnerAccountError) {
      toast.error(error.message);
      await signOutWebUser();
      clearAppState();
      router.push("/");
      return;
    }

    throw error;
  }

  setGroupId(profile.groupId);
  setActiveSpaceState(profile.activeSpace === "personal" ? "personal" : "family");
  setPixLauncherFilter(u.uid || ALL_LAUNCHERS);

  try {
    const groupMembers = await loadDashboardMembers(profile.groupId);
    setMembers(groupMembers);
  } catch (error) {
    console.error("Erro ao carregar membros:", error);
  }

  const all = await getDashboardMonths(u.uid, profile.groupId);

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
  }, [clearAppState, loadData, router]);

  const loadMonth = async (index: number, list = months) => {
    const m = list[index];
    if (!m) return;

    setCurrentIndex(index);
    setMonthId(m.id);

    await loadData(m.id);
  };

  const confirmCreateNext = async () => {
    const userNow = getCurrentWebUser();
    if (!userNow || !groupId || !months.length) return;

    const current = months[currentIndex];
    if (!current) return;

    const all = await createNextDashboardMonth(current, userNow.uid, groupId);
    setMonths(all);

    if (all.length > 0) {
      await loadMonth(all.length - 1, all);
    }

    setShowCreateMonthModal(false);
    toast.success("Novo mes criado com sucesso.");
  };

  const handleLogout = async () => {
    await signOutWebUser();
    clearAppState();
    router.push("/");
  };

  const confirmDeleteAccount = async () => {
    const currentUser = getCurrentWebUser();
    if (!currentUser) return;

    setIsDeletingAccount(true);

    try {
      const currentProfile = await deleteDashboardUserAccount(currentUser);
      if (currentProfile.personalGroupId === currentProfile.groupId) {
        toast.success("Espaço pessoal excluído.");
        window.location.reload();
        return;
      }
      await signOutWebUser();
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

  const switchSpace = async () => {
    const currentUser = getCurrentWebUser();
    if (!currentUser) return;
    const nextSpace = activeSpace === "family" ? "personal" : "family";
    try {
      await switchDashboardSpace(currentUser, nextSpace);
      setShowUserMenu(false);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao alternar espaço:", error);
      toast.error("Não foi possível alternar o espaço.");
    }
  };

  const openMembers = async () => {
    if (!groupId) return;

    setShowUserMenu(false);
    setShowMembersModal(true);
    setIsLoadingMembers(true);

    try {
      const groupMembers = await loadDashboardMembers(groupId);
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
    const currentUser = getCurrentWebUser();
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
      const groupMembers = await inviteDashboardMember(
        normalizedName,
        normalizedEmail,
        groupId,
        currentUser.uid
      );
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
      (member) => member.id === getCurrentWebUser()?.uid && member.role === "admin"
    );

  const confirmDeleteMember = async () => {
    if (!memberToDelete || !groupId) return;

    setIsDeletingMember(true);

    try {
      const groupMembers = await removeDashboardMember(memberToDelete, groupId);
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

  const askDelete = (acc: FinanceAccount) => {
    if (isCalculatedAccount(acc)) return;

    setAccountToDelete(acc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!monthId || !accountToDelete) return;

    await removeDashboardAccount(monthId, accountToDelete.id);

    setAccounts((prev) => prev.filter((a) => a.id !== accountToDelete.id));

    setShowDeleteModal(false);
    setAccountToDelete(null);
    toast.success("Conta excluida com sucesso.");
  };

  const isDeletingInstallmentAccount =
    isInstallmentAccount(accountToDelete);

  const openEdit = (acc: FinanceAccount) => {
    if (isCalculatedAccount(acc)) return;

    setEditAccount(acc);
    setEditValue(formatCurrencyInput(Number(acc.value || 0)));
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!monthId || !editAccount) return;

    const parsed = parseCurrency(editValue);

    await saveDashboardAccountValue(monthId, editAccount.id, parsed);

    setAccounts((prev) =>
      prev.map((a) => (a.id === editAccount.id ? { ...a, value: parsed } : a))
    );

    setShowEdit(false);
    toast.success("Valor editado com sucesso.");
  };

  const openExpectedEdit = (acc: FinanceAccount) => {
    setExpectedAccount(acc);
    setExpectedValue(formatCurrencyInput(Number(acc.expectedValue || 0)));
    setShowExpectedEdit(true);
  };

  const saveExpectedEdit = async () => {
    if (!monthId || !expectedAccount) return;

    const parsed = parseCurrency(expectedValue);

    await saveDashboardExpectedAccountValue(monthId, expectedAccount.id, parsed);

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
  const pixEditingTransaction = pixTransactions.find(
    (transaction) => transaction.id === pixEditingId
  );

  const startPixEdit = (transaction: FinanceTransaction) => {
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
    const nextAccountValue = await updateDashboardPixTransaction({
      monthId,
      transactionId: pixEditingTransaction.id,
      accountId: pixAccount.id,
      currentAccountValue: Number(pixAccount.value || 0),
      previousTransactionValue: previousValue,
      nextTransactionValue: nextValue,
    });

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

    const nextAccountValue = await removeDashboardPixTransaction({
      monthId,
      transactionId: pixDeletingTransaction.id,
      accountId: pixAccount.id,
      currentAccountValue: Number(pixAccount.value || 0),
      previousTransactionValue: Number(pixDeletingTransaction.value || 0),
    });

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

    await saveDashboardAccountOrder(
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

  const showInvestorArea = () => setActiveDashboardPage("investor");
  return (
    <div data-theme={activeSpace} className="min-h-screen bg-black px-6 pb-6 text-white">
      <DashboardHeader
        user={user}
        activeSpace={activeSpace}
        showPaymentSchedule={showPaymentSchedule}
        onTogglePaymentSchedule={() => setShowPaymentSchedule((current) => !current)}
        extratoHref={extratoHref}
        months={months}
        currentIndex={currentIndex}
        onLoadMonth={(index) => { void loadMonth(index); }}
        onCreateMonth={() => setShowCreateMonthModal(true)}
        onLaunch={() => setShowForm(true)}
        showUserMenu={showUserMenu}
        onToggleUserMenu={() => setShowUserMenu((previous) => !previous)}
        onSwitchSpace={switchSpace}
        onOpenMembers={openMembers}
        onOpenMoreOptions={() => {
          setShowUserMenu(false);
          setShowMoreOptionsModal(true);
        }}
        onLogout={handleLogout}
      />

      <DashboardProfileDialogs
        showMoreOptions={showMoreOptionsModal}
        showDeleteAccount={showDeleteAccountModal}
        isDeletingAccount={isDeletingAccount}
        showMembers={showMembersModal}
        members={members}
        isLoadingMembers={isLoadingMembers}
        canDeleteMembers={canDeleteMembers}
        memberToDelete={memberToDelete}
        isDeletingMember={isDeletingMember}
        showAddMember={showAddMemberModal}
        memberName={memberName}
        memberEmail={memberEmail}
        isSavingMember={isSavingMember}
        onCloseMoreOptions={() => setShowMoreOptionsModal(false)}
        onChooseDeleteAccount={() => {
          setShowMoreOptionsModal(false);
          setShowDeleteAccountModal(true);
        }}
        onConfirmDeleteAccount={confirmDeleteAccount}
        onCancelDeleteAccount={() => {
          if (!isDeletingAccount) setShowDeleteAccountModal(false);
        }}
        onOpenAddMember={openAddMember}
        onCloseMembers={() => setShowMembersModal(false)}
        onRequestRemoveMember={setMemberToDelete}
        onConfirmRemoveMember={confirmDeleteMember}
        onCancelRemoveMember={() => {
          if (!isDeletingMember) setMemberToDelete(null);
        }}
        onMemberNameChange={setMemberName}
        onMemberEmailChange={setMemberEmail}
        onSaveMember={saveMember}
        onCloseAddMember={closeAddMember}
      />
      <DashboardOverview
        realBalance={saldoReal}
        projectedBalance={saldoPrevisto}
        averageBalance={saldoMedio}
        formatMoney={formatMoney}
        valuesVisible={showValues}
        onToggleValues={() => setShowValues((previous) => !previous)}
        activeArea={activeDashboardPage}
        onActiveAreaChange={setActiveDashboardPage}
      >
      <section className="w-1/3 shrink-0 pr-2" aria-label="Área financeira" aria-hidden={activeDashboardPage !== "finances"} inert={activeDashboardPage !== "finances"}>
      <DashboardFinanceArea
        accounts={accounts}
        showPaymentSchedule={showPaymentSchedule}
        active={activeDashboardPage === "finances"}
        getAccountValue={getAccountValue}
        formatMoney={formatMoney}
        onToggle={(account) => handleTogglePaid(monthId!, account)}
        onDelete={askDelete}
        onEdit={openEdit}
        onEditDetails={setDetailsAccount}
        onAdd={(type) => setCreateModal({ open: true, type })}
        onOpenStatement={openCreditCardStatement}
        onOpenPixHistory={setPixAccount}
        onEditExpectedValue={openExpectedEdit}
        onReorder={handleReorderAccounts}
        onClosePaymentSchedule={() => setShowPaymentSchedule(false)}
      />
      </section>

      <section className="w-1/3 shrink-0 px-2" aria-label="Área do investidor" aria-hidden={activeDashboardPage !== "investor"} inert={activeDashboardPage !== "investor"}>
        {months[currentIndex] && groupId ? (
          <InvestorSettingsPanel
            key={`${groupId}:${monthId}`}
            groupId={groupId}
            userId={getCurrentWebUser()?.uid || ""}
            monthId={monthId!}
            year={months[currentIndex].year}
            month={months[currentIndex].month}
            formatMoney={formatMoney}
            onSaved={showInvestorArea}
            onMonthlyCashOutflowChange={updateInvestorCashOutflow}
          />
        ) : (
          <div className="min-h-[420px] rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
            Selecione um mês para configurar o planejamento de investimentos.
          </div>
        )}
      </section>

      <section className="w-1/3 shrink-0 pl-2" aria-label="Objetivos financeiros" aria-hidden={activeDashboardPage !== "goals"} inert={activeDashboardPage !== "goals"}>
        {months[currentIndex] && groupId ? (
          <FinancialGoalsPanel
            key={`${groupId}:${monthId}:goals`}
            groupId={groupId}
            userId={getCurrentWebUser()?.uid || ""}
            monthId={monthId!}
            year={months[currentIndex].year}
            month={months[currentIndex].month}
            formatMoney={formatMoney}
            onMonthlyPlanChange={updateGoalMonthlyPlan}
          />
        ) : (
          <div className="min-h-[420px] rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-400">
            Selecione um mês para organizar seus objetivos financeiros.
          </div>
        )}
      </section>
      </DashboardOverview>

      <DashboardAccountDialogs
        showEdit={showEdit}
        editValue={editValue}
        onEditValueChange={(value) => setEditValue(formatCurrencyTyping(value))}
        onSaveEdit={saveEdit}
        onCloseEdit={() => setShowEdit(false)}
        showExpectedEdit={showExpectedEdit}
        expectedAccount={expectedAccount}
        expectedValue={expectedValue}
        onExpectedValueChange={(value) => setExpectedValue(formatCurrencyTyping(value))}
        onSaveExpectedEdit={saveExpectedEdit}
        onCloseExpectedEdit={() => {
          setShowExpectedEdit(false);
          setExpectedAccount(null);
          setExpectedValue("");
        }}
        showDelete={showDeleteModal}
        deletingInstallmentAccount={isDeletingInstallmentAccount}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => {
          setShowDeleteModal(false);
          setAccountToDelete(null);
        }}
        showCreateMonth={showCreateMonthModal}
        onConfirmCreateMonth={confirmCreateNext}
        onCancelCreateMonth={() => setShowCreateMonthModal(false)}
      />
      {/* MODAL LANÇAMENTO */}
      <DashboardPixDialogs
        account={pixAccount}
        transactions={transactions}
        editingTransaction={pixEditingTransaction}
        deletingTransaction={pixDeletingTransaction}
        members={members}
        launcherFilter={pixLauncherFilter}
        editValue={pixEditValue}
        formatMoney={formatMoney}
        onFilterChange={(value) => setPixLauncherFilter(value)}
        onCloseHistory={closePixHistory}
        onStartEdit={startPixEdit}
        onAskDelete={setPixDeletingTransaction}
        onEditValueChange={(value) => setPixEditValue(formatCurrencyTyping(value))}
        onSaveEdit={savePixTransactionValue}
        onCancelEdit={cancelPixEdit}
        onConfirmDelete={confirmDeletePixTransaction}
        onCancelDelete={() => setPixDeletingTransaction(null)}
      />
      <LaunchModal
        open={showForm}
        onClose={() => setShowForm(false)}
        monthId={monthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={setTransactions}
        onMonthsChanged={async () => {
          if (!groupId) return;
          const refreshed = await reloadDashboardMonths(groupId);
          setMonths(refreshed);
        }}
      />

      {/* MODAL CRIAR CONTA */}
      <CreateAccountModal
        key={createModal.type || "closed"}
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
