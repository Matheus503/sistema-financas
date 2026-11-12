"use client";

import { useValueVisibility } from "../../../hooks/useValueVisibility";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getCurrentWebUser, observeWebUser, signOutWebUser } from "../../auth/application/webSession";
import {
  anticipateInstallmentPurchase,
  cancelInstallmentPurchaseFromInstallment,
  createCurrentMonth,
  createGroupAssignment,
  deleteCurrentUserAccount,
  deleteGroupMember,
  deleteTransaction,
  ensurePersonalSpace,
  ensureUserProfile,
  ExistingOwnerAccountError,
  getAccountsByMonth,
  getAllMonths,
  getGroupMembers,
  getTransactions,
  setActiveSpace,
  updateTransaction,
} from "../application/mobileDashboardCommands";
import { getCreditCardClosingDay, isCreditCardAccount } from "../../../domain/finance/account";
import type { FinanceAccount } from "../../../domain/finance/account";
import type { FinanceMonth } from "../../../domain/finance/month";
import type { FinanceTransaction } from "../../../domain/finance/transaction";
import type { GroupMemberListItem } from "../../../domain/finance/groupMember";
import MobileDashboardHeader from "./components/MobileDashboardHeader";
import MobileDashboardCreditCards from "./components/MobileDashboardCreditCards";
import MobileDashboardTransactions from "./components/MobileDashboardTransactions";
import MobileDashboardEditTransactionModal from "./components/MobileDashboardEditTransactionModal";
import MobileDashboardDeleteTransactionDialog from "./components/MobileDashboardDeleteTransactionDialog";
import MobileDashboardMembersDialogs from "./components/MobileDashboardMembersDialogs";
import MobileDashboardAccountDialogs from "./components/MobileDashboardAccountDialogs";
import type { User } from "firebase/auth";

import LaunchModal from "../../transaction-entry/ui/LaunchModal";

import EditAccountModal from "../../accounts/ui/EditAccountModal";
import { useModalKeyboardActions } from "../../../hooks/useModalKeyboardActions";

const ALL_LAUNCHERS = "all";

type LauncherFilter = string;

export default function MobileDashboard() {

  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [groupId, setGroupId] = useState("");
  const [activeSpace, setActiveSpaceState] = useState<"family" | "personal">("family");
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [monthId, setMonthId] =
    useState<string | null>(null);

  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);

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

  const [showValues, setShowValues] = useValueVisibility();
  const [
    creditCardSlideIndex,
    setCreditCardSlideIndex,
  ] = useState(0);
  const creditCardCarouselRef =
    useRef<HTMLDivElement | null>(null);
  const creditCardLoopTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [launcherFilter, setLauncherFilter] =
    useState<LauncherFilter>(ALL_LAUNCHERS);

  // 🔥 edição rápida
  const [editTransaction, setEditTransaction] =
    useState<FinanceTransaction | null>(null);

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
  ] = useState<FinanceTransaction | null>(null);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const renderValue = (value: number) =>
    showValues
      ? formatMoney(value)
      : "••••••";

  const formatDate = (date?: string) => {
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


  const getLauncherName = (
    transaction: FinanceTransaction
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
    transaction: FinanceTransaction,
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
    await signOutWebUser();
    setShowUserMenu(false);
    setShowMembersModal(false);
    setShowAddMemberModal(false);
    setShowMoreOptionsModal(false);
    setShowDeleteAccountModal(false);
    router.push("/");
  };

  const confirmDeleteAccount = async () => {
    const currentUser = getCurrentWebUser();
    if (!currentUser) return;

    setIsDeletingAccount(true);

    try {
      const currentProfile = await ensureUserProfile(currentUser);
      await deleteCurrentUserAccount(currentProfile);
      if (currentProfile.personalGroupId === currentProfile.groupId) {
        toast.success("Espaço pessoal excluído.");
        window.location.reload();
        return;
      }
      await signOutWebUser();
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
      (member) => member.id === getCurrentWebUser()?.uid && member.role === "admin"
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
          getCurrentWebUser()?.uid ||
          "";
        const userName =
          editTransaction.launcherName ||
          editTransaction.userName ||
          getCurrentWebUser()?.displayName ||
          getCurrentWebUser()?.email ||
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
    enabled: Boolean(editTransaction),
    onCancel: closeEditTransaction,
    onConfirm: saveEditTransaction,
  });

  useModalKeyboardActions({
    enabled: Boolean(deleteTransactionData),
    onCancel: () => setDeleteTransactionData(null),
    onConfirm: confirmDeleteTransaction,
  });

  // Aguarda o Firebase restaurar a sessão persistida antes de redirecionar.
  useEffect(() => {
    let active = true;
    const unsubscribe = observeWebUser(async (user) => {
      if (!user) {
        setIsCheckingSession(true);
        router.replace("/");
        return;
      }

      setIsCheckingSession(true);
      setUser(user);
      setLauncherFilter(user.uid || ALL_LAUNCHERS);
      setShowAccountMenu(true);

      let profile;

      try {
        profile = await ensureUserProfile(user);
      } catch (error) {
        if (error instanceof ExistingOwnerAccountError) {
          toast.error(error.message);
          await signOutWebUser();
          if (active) router.replace("/");
          return;
        }

        console.error("Erro ao carregar perfil mobile:", error);
        toast.error("Nao foi possivel carregar seu perfil.");
        await signOutWebUser();
        if (active) router.replace("/");
        return;
      }

      if (!active) return;

      setGroupId(profile.groupId);
      setActiveSpaceState(profile.activeSpace === "personal" ? "personal" : "family");

      const [initialMonths, groupMembers] =
        await Promise.all([
          getAllMonths(profile.groupId),
          getGroupMembers(profile.groupId),
        ]);
      if (!active) return;
      let all = initialMonths;

      if (all.length === 0) {
        await createCurrentMonth(user.uid, profile.groupId);
        all = await getAllMonths(profile.groupId);
      }

      if (!active) return;

      setMembers(groupMembers);

      setMonths(all);

      const lastIndex =
        all.length - 1;

      setCurrentIndex(lastIndex);

      setMonthId(
        all[lastIndex].id
      );
      setIsCheckingSession(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const switchSpace = async () => {
    const currentUser = getCurrentWebUser();
    if (!currentUser) return;
    const nextSpace = activeSpace === "family" ? "personal" : "family";
    try {
      if (nextSpace === "personal") await ensurePersonalSpace(currentUser);
      await setActiveSpace(currentUser, nextSpace);
      setShowUserMenu(false);
      window.location.reload();
    } catch (error) {
      console.error("Erro ao alternar espaço:", error);
      toast.error("Não foi possível alternar o espaço.");
    }
  };

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
      setAccounts(accs as FinanceAccount[]);
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


  // 🔹 cálculo contas
  const getAccountValue = (
    acc: FinanceAccount
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

  const creditCardAccounts =
    accounts.filter((account) =>
      isCreditCardAccount(account)
    );

  const getCreditCardDateInfo = (
    account: FinanceAccount
  ) => {
    const closingDay =
      getCreditCardClosingDay(account);
    const dueDay =
      Number(account.dia_vencimento);

    return Number.isInteger(dueDay) &&
      dueDay >= 1 &&
      dueDay <= 31
      ? `Fecha dia ${closingDay} • Vence dia ${dueDay}`
      : `Fecha dia ${closingDay}`;
  };

  const creditCardSlides =
    creditCardAccounts.length > 1
      ? [
          {
            id: "all",
            account: null,
            label: "Total Cartões",
            detail: "",
            value: creditCardAccounts.reduce(
              (sum, account) =>
                sum + getAccountValue(account),
              0
            ),
          },
          ...creditCardAccounts.map((account) => ({
            id: account.id,
            account,
            label: account.name,
            detail: getCreditCardDateInfo(account),
            value: getAccountValue(account),
          })),
        ]
      : creditCardAccounts.map((account) => ({
          id: account.id,
          account,
          label: account.name,
          detail: getCreditCardDateInfo(account),
          value: getAccountValue(account),
        }));

  const creditCardCarouselSlides =
    creditCardSlides.length > 1
      ? [
          ...creditCardSlides,
          {
            ...creditCardSlides[0],
            id: `${creditCardSlides[0].id}-loop`,
          },
        ]
      : creditCardSlides;
  const activeCreditCardSlideIndex = Math.min(
    creditCardSlideIndex,
    Math.max(creditCardSlides.length - 1, 0),
  );

  const handleCreditCardScroll = (
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const { scrollLeft, clientWidth } =
      event.currentTarget;

    if (!clientWidth) return;

    const nextIndex =
      Math.round(scrollLeft / clientWidth);

    if (
      creditCardSlides.length > 1 &&
      nextIndex >= creditCardSlides.length
    ) {
      setCreditCardSlideIndex(0);

      if (creditCardLoopTimeoutRef.current) {
        clearTimeout(creditCardLoopTimeoutRef.current);
      }

      creditCardLoopTimeoutRef.current = setTimeout(() => {
        creditCardCarouselRef.current?.scrollTo({
          left: 0,
          behavior: "instant",
        });
      }, 180);

      return;
    }

    setCreditCardSlideIndex(nextIndex);
  };

  useEffect(() => {
    if (creditCardSlideIndex < creditCardSlides.length) return;

    creditCardCarouselRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [
    creditCardSlideIndex,
    creditCardSlides.length,
  ]);

  useEffect(() => {
    return () => {
      if (creditCardLoopTimeoutRef.current) {
        clearTimeout(creditCardLoopTimeoutRef.current);
      }
    };
  }, []);

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

  if (isCheckingSession) {
    return <div className="min-h-screen bg-black" aria-busy="true" />;
  }

  return (
    <div data-theme={activeSpace} className="min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white px-4 pb-6 flex flex-col gap-5">

      <MobileDashboardHeader
        user={user}
        showAccountMenu={showAccountMenu}
        isSideMenuOpen={isSideMenuOpen}
        showUserMenu={showUserMenu}
        activeSpace={activeSpace}
        months={months}
        currentIndex={currentIndex}
        monthId={monthId}
        onSideMenuChange={setIsSideMenuOpen}
        onUserMenuChange={setShowUserMenu}
        onSwitchSpace={switchSpace}
        onOpenMembers={openMembers}
        onOpenMoreOptions={() => { setShowUserMenu(false); setShowMoreOptionsModal(true); }}
        onLogout={handleLogout}
        onNavigate={(href) => router.push(href)}
        onPreviousMonth={goPrev}
        onNextMonth={goNext}
        onSelectMonth={(index) => { setCurrentIndex(index); setMonthId(months[index].id); }}
      />
      <MobileDashboardAccountDialogs
        showOptions={showMoreOptionsModal}
        showDeleteAccount={showDeleteAccountModal}
        isDeletingAccount={isDeletingAccount}
        onCloseOptions={() => setShowMoreOptionsModal(false)}
        onRequestDeleteAccount={() => {
          setShowMoreOptionsModal(false);
          setShowDeleteAccountModal(true);
        }}
        onConfirmDeleteAccount={confirmDeleteAccount}
        onCancelDeleteAccount={() => {
          if (!isDeletingAccount) setShowDeleteAccountModal(false);
        }}
      />
      <MobileDashboardCreditCards
        slides={creditCardSlides}
        carouselSlides={creditCardCarouselSlides}
        activeSlideIndex={activeCreditCardSlideIndex}
        carouselRef={creditCardCarouselRef}
        showValues={showValues}
        renderValue={renderValue}
        onToggleValues={() => setShowValues((prev) => !prev)}
        onSelectAccount={setDetailsAccount}
        onScroll={handleCreditCardScroll}
      />
      <MobileDashboardTransactions
        transactions={monthTransactions}
        members={members}
        launcherFilter={launcherFilter}
        onLauncherFilterChange={setLauncherFilter}
        getMemberLabel={getMemberLabel}
        getLauncherName={getLauncherName}
        formatDate={formatDate}
        renderValue={renderValue}
        onEdit={(transaction) => {
          setEditTransaction(transaction);
          setEditValue(Number(transaction.value || 0).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }));
          setAnticipateInstallments(false);
          setAnticipationInstallments("");
          setAnticipationPaidValue("");
        }}
        onDelete={setDeleteTransactionData}
      />
      {/* BOTÃO */}
      <button
        className="fixed bottom-6 right-6 bg-purple-600 w-16 h-16 rounded-full text-3xl shadow-lg"
        onClick={() =>
          setOpenModal(true)
        }
      >
        +
      </button>

      <MobileDashboardEditTransactionModal
        transaction={editTransaction}
        value={editValue}
        onValueChange={setEditValue}
        formatCurrencyInput={formatCurrencyInput}
        canAnticipate={canAnticipateEditTransaction}
        anticipateInstallments={anticipateInstallments}
        onAnticipateChange={(checked) => {
          setAnticipateInstallments(checked);
          if (checked) {
            setAnticipationInstallments(editRemainingInstallments ? String(editRemainingInstallments) : "");
            setAnticipationPaidValue("");
          } else {
            setAnticipationInstallments("");
            setAnticipationPaidValue("");
          }
        }}
        anticipationInstallments={anticipationInstallments}
        onAnticipationInstallmentsChange={setAnticipationInstallments}
        remainingInstallments={editRemainingInstallments}
        anticipationPaidValue={anticipationPaidValue}
        onAnticipationPaidValueChange={setAnticipationPaidValue}
        originalAmount={anticipationOriginalAmount}
        discountAmount={anticipationDiscountAmount}
        formatMoney={formatMoney}
        onSave={saveEditTransaction}
        onClose={closeEditTransaction}
      />
      <MobileDashboardDeleteTransactionDialog
        transaction={deleteTransactionData}
        isInstallment={isDeletingInstallmentTransaction}
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setDeleteTransactionData(null)}
      />
      <MobileDashboardMembersDialogs
        showMembers={showMembersModal}
        showAddMember={showAddMemberModal}
        members={members}
        isLoadingMembers={isLoadingMembers}
        canDeleteMembers={canDeleteMembers}
        memberToDelete={memberToDelete}
        isDeletingMember={isDeletingMember}
        isSavingMember={isSavingMember}
        memberName={memberName}
        memberEmail={memberEmail}
        onOpenAddMember={openAddMember}
        onCloseMembers={() => setShowMembersModal(false)}
        onRequestDelete={setMemberToDelete}
        onConfirmDelete={confirmDeleteMember}
        onCancelDelete={() => { if (!isDeletingMember) setMemberToDelete(null); }}
        onMemberNameChange={setMemberName}
        onMemberEmailChange={setMemberEmail}
        onSaveMember={saveMember}
        onCancelAddMember={closeAddMember}
      />
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
              (month: FinanceMonth) =>
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
