import { useCallback, useEffect, useMemo, useState } from "react";
import type { FinanceMonth } from "../../../../../../src/domain/finance/month";
import type { FinanceAccount } from "../../../../../../src/domain/finance/account";
import type { FinanceTransaction } from "../../../../../../src/domain/finance/transaction";
import type { FinanceCategory } from "../../../../../../src/domain/finance/category";
import type { GroupMemberListItem } from "../../../../../../src/domain/finance/groupMember";
import { mobileDashboardRepository } from "../../../platform/firebaseClient";
import {
  loadMobileDashboardMonthData,
  loadMobileDashboardMonths,
  loadMobileMonthlyReport,
  createMobileDashboardTransaction,
  editMobileDashboardTransaction,
  deleteMobileDashboardTransaction,
  summarizeMobileDashboardMonth,
  toggleMobileDashboardAccountPaid,
  createMobileDashboardAccount,
  updateMobileDashboardAccount,
  deleteMobileDashboardAccount,
  type MobileAccountCreationInput,
  type MobileCommonAccountUpdate,
  type MobileLaunchInput,
} from "../application/mobileDashboard";
import type { MobileDashboardAdjustments } from "../contracts";

export function useMobileDashboard(groupId: string) {
  const [months, setMonths] = useState<FinanceMonth[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [members, setMembers] = useState<GroupMemberListItem[]>([]);
  const [monthAdjustments, setMonthAdjustments] = useState<Record<string, MobileDashboardAdjustments>>({});
  const [loadedMonthsGroupId, setLoadedMonthsGroupId] = useState("");
  const [loadedMonthId, setLoadedMonthId] = useState<string | null>(null);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountMutationError, setAccountMutationError] = useState("");
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transactionMutationError, setTransactionMutationError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const repository = mobileDashboardRepository;

    if (!groupId || !repository) {
      return () => {
        active = false;
      };
    }

    void loadMobileDashboardMonths(repository, groupId)
      .then(({ months: loadedMonths, adjustments: loadedAdjustments, initialMonthId }) => {
        if (!active) return;
        setMonths(loadedMonths);
        setMonthAdjustments(loadedAdjustments);
        setActiveMonthId(initialMonthId);
        setLoadedMonthsGroupId(groupId);
        setError("");
      })
      .catch((loadError) => {
        console.error("Não foi possível carregar os meses financeiros:", loadError);
        if (active) {
          setMonths([]);
          setMonthAdjustments({});
          setActiveMonthId(null);
          setLoadedMonthsGroupId(groupId);
          setError("Não foi possível carregar seus meses financeiros.");
        }
      });

    void repository.getGroupMembers(groupId)
      .then((loadedMembers) => { if (active) setMembers(loadedMembers); })
      .catch((loadError) => { console.error("Não foi possível carregar os membros:", loadError); });

    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    let active = true;
    const repository = mobileDashboardRepository;
    if (!groupId || !repository) return () => { active = false; };
    void repository.getCategories(groupId)
      .then((loadedCategories) => { if (active) setCategories(loadedCategories); })
      .catch((loadError) => { console.error("Não foi possível carregar as categorias:", loadError); });
    return () => { active = false; };
  }, [groupId]);

  useEffect(() => {
    let active = true;
    const repository = mobileDashboardRepository;

    if (!activeMonthId || !repository) {
      return () => {
        active = false;
      };
    }

    void loadMobileDashboardMonthData(repository, activeMonthId)
      .then(({ accounts: loadedAccounts, transactions: loadedTransactions }) => {
        if (!active) return;
        setAccounts(loadedAccounts);
        setTransactions(loadedTransactions);
        setLoadedMonthId(activeMonthId);
        setError("");
      })
      .catch((loadError) => {
        console.error("Não foi possível carregar os dados do mês:", loadError);
        if (active) {
          setAccounts([]);
          setTransactions([]);
          setLoadedMonthId(activeMonthId);
          setError("Não foi possível carregar as contas deste mês.");
        }
      });

    return () => {
      active = false;
    };
  }, [activeMonthId]);

  const activeMonth = months.find((month) => month.id === activeMonthId) || null;
  const activeAdjustments = activeMonthId ? monthAdjustments[activeMonthId] : undefined;
  const { accountTotals: accountsByType, transactionTotals, realBalance } = useMemo(
    () => summarizeMobileDashboardMonth(accounts, transactions, activeAdjustments),
    [accounts, transactions, activeAdjustments],
  );
  const isLoadingMonths = Boolean(groupId && loadedMonthsGroupId !== groupId);
  const isLoadingMonth = Boolean(activeMonthId && loadedMonthId !== activeMonthId);

  const moveMonth = useCallback((offset: number) => {
    const index = months.findIndex((month) => month.id === activeMonthId);
    const target = months[index + offset];
    if (target) setActiveMonthId(target.id);
  }, [activeMonthId, months]);

  const toggleAccountPaid = useCallback(async (account: FinanceAccount) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || updatingAccountId) return;
    setUpdatingAccountId(account.id);
    setAccountMutationError("");
    try {
      await toggleMobileDashboardAccountPaid(
        repository,
        activeMonthId,
        account.id,
        Boolean(account.isPaid),
      );
      const refreshedMonth = await loadMobileDashboardMonthData(repository, activeMonthId);
      setAccounts(refreshedMonth.accounts);
      setTransactions(refreshedMonth.transactions);
    } catch (updateError) {
      console.error("Não foi possível atualizar o status da conta:", updateError);
      setAccountMutationError("Não foi possível atualizar o status desta conta.");
    } finally {
      setUpdatingAccountId(null);
    }
  }, [activeMonthId, updatingAccountId]);

  const addAccount = useCallback(async (input: MobileAccountCreationInput) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || isCreatingAccount || updatingAccountId) return false;
    setIsCreatingAccount(true);
    setAccountMutationError("");
    try {
      const account = await createMobileDashboardAccount(repository, activeMonthId, accounts, input);
      setAccounts((current) => [...current, account]);
      return true;
    } catch (createError) {
      console.error("Não foi possível criar a conta:", createError);
      setAccountMutationError(createError instanceof Error ? createError.message : "Não foi possível criar a conta.");
      return false;
    } finally {
      setIsCreatingAccount(false);
    }
  }, [accounts, activeMonthId, isCreatingAccount, updatingAccountId]);

  const editAccount = useCallback(async (account: FinanceAccount, input: MobileCommonAccountUpdate) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || updatingAccountId || isCreatingAccount) return false;
    setUpdatingAccountId(account.id);
    setAccountMutationError("");
    try {
      await updateMobileDashboardAccount(repository, activeMonthId, account, input);
      const refreshed = await loadMobileDashboardMonthData(repository, activeMonthId);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      return true;
    } catch (updateError) {
      console.error("Não foi possível editar a conta:", updateError);
      setAccountMutationError(updateError instanceof Error ? updateError.message : "Não foi possível editar esta conta.");
      return false;
    } finally {
      setUpdatingAccountId(null);
    }
  }, [activeMonthId, isCreatingAccount, updatingAccountId]);

  const removeAccount = useCallback(async (account: FinanceAccount) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || updatingAccountId || isCreatingAccount) return false;
    setUpdatingAccountId(account.id);
    setAccountMutationError("");
    try {
      await deleteMobileDashboardAccount(repository, activeMonthId, groupId, account);
      const refreshed = await loadMobileDashboardMonthData(repository, activeMonthId);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      return true;
    } catch (deleteError) {
      console.error("Não foi possível excluir a conta:", deleteError);
      setAccountMutationError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir esta conta.");
      return false;
    } finally {
      setUpdatingAccountId(null);
    }
  }, [activeMonthId, groupId, isCreatingAccount, updatingAccountId]);

  const addTransaction = useCallback(async (input: Omit<MobileLaunchInput, "monthId" | "months" | "accounts" | "groupId">) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || isCreatingTransaction || !groupId) return false;
    setIsCreatingTransaction(true);
    setTransactionMutationError("");
    try {
      const result = await createMobileDashboardTransaction(repository, {
        ...input,
        monthId: activeMonthId,
        months,
        accounts,
        groupId,
      });
      setMonths(result.months);
      setActiveMonthId(result.targetMonthId);
      const refreshed = await loadMobileDashboardMonthData(repository, result.targetMonthId);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      setLoadedMonthId(result.targetMonthId);
      return true;
    } catch (createError) {
      console.error("Não foi possível criar o lançamento:", createError);
      setTransactionMutationError(createError instanceof Error ? createError.message : "Não foi possível criar o lançamento.");
      return false;
    } finally {
      setIsCreatingTransaction(false);
    }
  }, [accounts, activeMonthId, groupId, isCreatingTransaction, months]);

  const editTransaction = useCallback(async (transaction: FinanceTransaction, value: number) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || isCreatingTransaction) return false;
    setIsCreatingTransaction(true);
    setTransactionMutationError("");
    try {
      await editMobileDashboardTransaction(repository, activeMonthId, accounts, transaction, value);
      const refreshed = await loadMobileDashboardMonthData(repository, activeMonthId);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      return true;
    } catch (editError) {
      console.error("Não foi possível editar o lançamento:", editError);
      setTransactionMutationError(editError instanceof Error ? editError.message : "Não foi possível editar este lançamento.");
      return false;
    } finally { setIsCreatingTransaction(false); }
  }, [accounts, activeMonthId, isCreatingTransaction]);

  const removeTransaction = useCallback(async (transaction: FinanceTransaction) => {
    const repository = mobileDashboardRepository;
    if (!repository || !activeMonthId || isCreatingTransaction || !groupId) return false;
    setIsCreatingTransaction(true);
    setTransactionMutationError("");
    try {
      await deleteMobileDashboardTransaction(repository, activeMonthId, groupId, accounts, transaction);
      const refreshed = await loadMobileDashboardMonthData(repository, activeMonthId);
      setAccounts(refreshed.accounts);
      setTransactions(refreshed.transactions);
      const refreshedMonths = await loadMobileDashboardMonths(repository, groupId);
      setMonths(refreshedMonths.months);
      return true;
    } catch (deleteError) {
      console.error("Não foi possível excluir o lançamento:", deleteError);
      setTransactionMutationError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir este lançamento.");
      return false;
    } finally { setIsCreatingTransaction(false); }
  }, [accounts, activeMonthId, groupId, isCreatingTransaction]);

  const getMonthlyReport = useCallback(async () => {
    if (!mobileDashboardRepository) throw new Error("Firebase não está disponível.");
    return loadMobileMonthlyReport(mobileDashboardRepository, groupId);
  }, [groupId]);
  const updateSettlementDate = useCallback(async (monthId: string, accountId: string, date: string) => {
    if (!mobileDashboardRepository) throw new Error("Firebase não está disponível.");
    return mobileDashboardRepository.updateSettlementDate(monthId, accountId, date);
  }, []);

  return {
    months,
    activeMonth,
    accounts,
    transactions,
    categories,
    members,
    transactionTotals,
    accountsByType,
    realBalance,
    investmentImpactCents: activeAdjustments?.investmentImpactCents || 0,
    goalContributionCents: activeAdjustments?.goalContributionCents || 0,
    updatingAccountId,
    accountMutationError,
    clearAccountMutationError: () => setAccountMutationError(""),
    isCreatingAccount,
    isCreatingTransaction,
    transactionMutationError,
    clearTransactionMutationError: () => setTransactionMutationError(""),
    toggleAccountPaid,
    addAccount,
    addTransaction,
    editTransaction,
    removeTransaction,
    getMonthlyReport,
    updateSettlementDate,
    editAccount,
    removeAccount,
    isLoading: isLoadingMonths || isLoadingMonth,
    error,
    canGoPrevious: months.findIndex((month) => month.id === activeMonthId) > 0,
    canGoNext: months.findIndex((month) => month.id === activeMonthId) < months.length - 1,
    moveMonth,
  };
}
