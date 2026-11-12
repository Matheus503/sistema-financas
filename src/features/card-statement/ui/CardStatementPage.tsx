"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getCurrentWebUser, observeWebUser } from "../../auth/application/webSession";
import {
  ensureCardStatementProfile as ensureUserProfile,
} from "../application/cardStatementCommands";
import { loadCardStatementMonth } from "../application/loadCardStatementMonth";
import {
  deleteCardStatementEntry,
  saveCardStatementEdit,
} from "../application/cardStatementMutations";
import { isCreditCardAccount } from "../../../domain/finance/account";
import type { FinanceAccount } from "../../../domain/finance/account";
import {
  type CardStatementItem as ExtratoItem,
  type CardStatementTransaction as Transaction,
} from "../application/cardStatementViewModel";
import type { GroupMemberListItem } from "../../../domain/finance/groupMember";
import CardStatementHeader from "./components/CardStatementHeader";
import CardStatementFilters from "./components/CardStatementFilters";
import CardStatementTransactions from "./components/CardStatementTransactions";
import CardStatementEditDialog from "./components/CardStatementEditDialog";
import CardStatementDeleteDialog from "./components/CardStatementDeleteDialog";
import InvoiceReconciliationModal from "./components/InvoiceReconciliationModal";
import LaunchModal from "../../transaction-entry/ui/LaunchModal";
import { useModalKeyboardActions } from "../../../hooks/useModalKeyboardActions";
import type { NubankEntry } from "../../../lib/nubankCsvParser";
import type { SystemInvoiceEntry } from "../../../lib/invoiceReconciliation";

type TransactionGroup = {
  monthLabel: string;
  items: ExtratoItem[];
};

type LaunchInitialValues = {
  accountId?: string;
  value?: number;
  date?: string;
  category?: string;
  note?: string;
};

const ALL_LAUNCHERS = "all";
const ALL_CREDIT_CARDS = "all";
const PERIOD_CURRENT_INVOICE = "current_invoice";
const PERIOD_THIS_MONTH = "this_month";
const PERIOD_LAST_30_DAYS = "last_30_days";
const PERIOD_CUSTOM = "custom";

function ExtratoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonthId = searchParams.get("monthId");
  const requestedCreditCardId = searchParams.get("creditCardId");

  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState(true);

  const [currentUserId, setCurrentUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMemberListItem[]>([]);

  const [allItems, setAllItems] = useState<ExtratoItem[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [, setTransactions] = useState<Transaction[]>([]);
  const [activeMonthId, setActiveMonthId] = useState<string | null>(null);
  const [monthTitle, setMonthTitle] = useState("Extrato de cartão");
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchInitialValues, setLaunchInitialValues] =
    useState<LaunchInitialValues | null>(null);
  const [reconciliationMonthLabel, setReconciliationMonthLabel] = useState<
    string | null
  >(null);

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [periodFilter, setPeriodFilter] = useState(PERIOD_CURRENT_INVOICE);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [rangeHoverDate, setRangeHoverDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLauncher, setFilterLauncher] = useState(ALL_LAUNCHERS);
  const [filterCreditCard, setFilterCreditCard] = useState(
    () => requestedCreditCardId || ALL_CREDIT_CARDS,
  );

  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<ExtratoItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [anticipateInstallments, setAnticipateInstallments] = useState(false);
  const [anticipationInstallments, setAnticipationInstallments] = useState("");
  const [anticipationPaidValue, setAnticipationPaidValue] = useState("");
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ExtratoItem | null>(null);

  const formatMoney = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

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

  const formatCurrencyTyping = (nextValue: string) => {
    const numbers = nextValue.replace(/\D/g, "");
    const amount = Number(numbers) / 100;

    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const normalizeText = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const getMemberLabel = (member: GroupMemberListItem) =>
    member.name || member.email.split("@")[0] || "Sem nome";

  const getSelectedLauncherLabel = () => {
    if (filterLauncher === ALL_LAUNCHERS) return "Todos os Lancamentos";

    const member = groupMembers.find((item) => item.id === filterLauncher);
    return member ? `Lancamentos ${getMemberLabel(member)}` : "Lancamentos";
  };

  const creditCardAccounts = useMemo(() => {
    return accounts.filter((account) => isCreditCardAccount(account));
  }, [accounts]);

  const getSelectedCreditCardLabel = () => {
    if (filterCreditCard === ALL_CREDIT_CARDS) return "Todos os cartões";

    const card = creditCardAccounts.find(
      (item) => item.id === filterCreditCard,
    );
    return card?.name || "Cartão";
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditItem(null);
    setEditValue("");
    setAnticipateInstallments(false);
    setAnticipationInstallments("");
    setAnticipationPaidValue("");
  };

  const itemMatchesMember = useCallback(
    (item: ExtratoItem, member: GroupMemberListItem) => {
      const launcherId = item.launcherId || item.userId || "";

      if (
        member.status === "active" &&
        launcherId &&
        launcherId === member.id
      ) {
        return true;
      }

      const rawLauncher = normalizeText(
        `${item.launcherName || ""} ${item.userName || ""}`,
      );
      const memberName = normalizeText(member.name);
      const memberEmail = normalizeText(member.email);
      const memberEmailPrefix = normalizeText(member.email.split("@")[0] || "");

      return Boolean(
        rawLauncher &&
        ((memberName && rawLauncher.includes(memberName)) ||
          (memberEmail && rawLauncher.includes(memberEmail)) ||
          (memberEmailPrefix && rawLauncher.includes(memberEmailPrefix))),
      );
    },
    [],
  );

  const normalizeDateKey = (value: string) => {
    if (!value) return "";

    const trimmed = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.includes("T")) {
      return trimmed.slice(0, 10);
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const parseDateKey = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateLabel = (value: string) => {
    const date = parseDateKey(value);
    if (!date) return "";

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getDateRangeLabel = () => {
    if (periodFilter === PERIOD_CURRENT_INVOICE) return "Fatura atual";
    if (periodFilter === PERIOD_THIS_MONTH) return "Este mês";
    if (periodFilter === PERIOD_LAST_30_DAYS) return "Últimos 30 dias";

    if (filterStartDate && filterEndDate) {
      return `${formatDateLabel(filterStartDate)} - ${formatDateLabel(
        filterEndDate,
      )}`;
    }

    if (filterStartDate) return `${formatDateLabel(filterStartDate)} - ...`;

    return "Selecionar período";
  };

  const clearDateRange = () => {
    setPeriodFilter(PERIOD_CURRENT_INVOICE);
    setFilterStartDate("");
    setFilterEndDate("");
    setRangeHoverDate("");
  };

  const addCalendarMonths = (date: Date, amount: number) =>
    new Date(date.getFullYear(), date.getMonth() + amount, 1);

  const getCalendarDays = (monthDate: Date) => {
    const firstDayOfMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1,
    );
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        date,
        key: getDateKey(date),
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      };
    });
  };

  const isDateInRange = (dateKey: string) => {
    const endDate = filterEndDate || rangeHoverDate;

    if (!filterStartDate || !endDate) return false;

    const start = filterStartDate < endDate ? filterStartDate : endDate;
    const end = filterStartDate < endDate ? endDate : filterStartDate;

    return dateKey >= start && dateKey <= end;
  };

  const selectRangeDate = (dateKey: string) => {
    setPeriodFilter(PERIOD_CUSTOM);

    if (!filterStartDate || filterEndDate) {
      setFilterStartDate(dateKey);
      setFilterEndDate("");
      setRangeHoverDate("");
      return;
    }

    if (dateKey < filterStartDate) {
      setFilterEndDate(filterStartDate);
      setFilterStartDate(dateKey);
    } else {
      setFilterEndDate(dateKey);
    }

    setRangeHoverDate("");
    setShowDateRangePicker(false);
  };

  const applyPeriodFilter = (value: string) => {
    setPeriodFilter(value);

    const today = new Date();

    if (value === PERIOD_CURRENT_INVOICE) {
      setFilterStartDate("");
      setFilterEndDate("");
      setRangeHoverDate("");
      return;
    }

    if (value === PERIOD_THIS_MONTH) {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterStartDate(getDateKey(firstDay));
      setFilterEndDate(getDateKey(today));
      setRangeHoverDate("");
      return;
    }

    if (value === PERIOD_LAST_30_DAYS) {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      setFilterStartDate(getDateKey(start));
      setFilterEndDate(getDateKey(today));
      setRangeHoverDate("");
    }
  };

  const renderCalendarMonth = (monthDate: Date) => {
    const monthLabel = monthDate.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

    return (
      <div className="min-w-0">
        <div className="mb-3 text-center text-sm font-semibold capitalize">
          {monthLabel}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500 mb-1">
          {weekDays.map((day, index) => (
            <div key={`${day}-${index}`}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {getCalendarDays(monthDate).map((item) => {
            const isSelected =
              item.key === filterStartDate || item.key === filterEndDate;
            const isInRange = isDateInRange(item.key);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectRangeDate(item.key)}
                onMouseEnter={() => setRangeHoverDate(item.key)}
                className={`h-9 rounded-lg text-sm transition ${
                  isSelected
                    ? "bg-purple-600 text-white font-bold"
                    : isInRange
                      ? "bg-purple-600/20 text-purple-100"
                      : item.isCurrentMonth
                        ? "text-zinc-100 hover:bg-zinc-800"
                        : "text-zinc-600 hover:bg-zinc-800/60"
                }`}
              >
                {item.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const loadExtrato = useCallback(async () => {
    const user = getCurrentWebUser();
    if (!user) {
      router.push("/");
      return;
    }

    setLoading(true);

    try {
      const profile = await ensureUserProfile(user);
      setGroupId(profile.groupId);
      const result = await loadCardStatementMonth(profile.groupId, requestedMonthId);
      setGroupMembers(result.members);

      if (!result.month) {
        setAllItems([]);
        setAccounts([]);
        setTransactions([]);
        setActiveMonthId(null);
        setMonthTitle("Extrato de cartão");
        return;
      }

      const label = result.monthLabel;
      setAccounts(result.accounts);
      setTransactions(result.transactions);
      setActiveMonthId(result.month.id);

      setMonthTitle(label);
      setAllItems(result.items);
    } finally {
      setLoading(false);
    }
  }, [requestedMonthId, router]);

  useEffect(() => {
    const unsub = observeWebUser(async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      setCurrentUserId(user.uid);
      setFilterLauncher(user.uid || ALL_LAUNCHERS);

      await loadExtrato();
    });

    return () => unsub();
  }, [loadExtrato, router]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (
        filterCreditCard !== ALL_CREDIT_CARDS &&
        item.accountId !== filterCreditCard
      ) {
        return false;
      }

      if (filterStartDate || filterEndDate) {
        const itemDateKey = normalizeDateKey(item.date);
        if (!itemDateKey) return false;

        if (filterStartDate && itemDateKey < filterStartDate) return false;
        if (filterEndDate && itemDateKey > filterEndDate) return false;
      }

      if (filterCategory) {
        if ((item.category || "") !== filterCategory) return false;
      }

      if (filterLauncher !== ALL_LAUNCHERS) {
        const member = groupMembers.find((item) => item.id === filterLauncher);
        if (!member || !itemMatchesMember(item, member)) return false;
      }

      return true;
    });
  }, [
    allItems,
    filterCreditCard,
    filterStartDate,
    filterEndDate,
    filterCategory,
    filterLauncher,
    groupMembers,
    itemMatchesMember,
  ]);

  const groups = useMemo<TransactionGroup[]>(() => {
    return [
      {
        monthLabel: monthTitle,
        items: filteredItems,
      },
    ];
  }, [filteredItems, monthTitle]);

  const total = useMemo(
    () => filteredItems.reduce((sum, item) => sum + item.value, 0),
    [filteredItems],
  );

  const reconciliationCreditCardId = useMemo(() => {
    if (filterCreditCard !== ALL_CREDIT_CARDS) return filterCreditCard;

    const primaryCard = creditCardAccounts.find(
      (account) => account.isPrimaryCreditCard === true,
    );
    const nubankCard = creditCardAccounts.find((account) =>
      normalizeText(account.name).includes("nubank"),
    );

    return String(
      primaryCard?.id || nubankCard?.id || creditCardAccounts[0]?.id || "",
    );
  }, [creditCardAccounts, filterCreditCard]);

  const reconciliationGroups = useMemo(() => {
    const items = reconciliationCreditCardId
      ? allItems.filter((item) => item.accountId === reconciliationCreditCardId)
      : [];

    return [
      {
        monthLabel: monthTitle,
        items,
      },
    ];
  }, [allItems, monthTitle, reconciliationCreditCardId]);

  const activeReconciliationGroup = reconciliationMonthLabel
    ? reconciliationGroups.find(
        (group) => group.monthLabel === reconciliationMonthLabel,
      ) || null
    : null;

  const categories = useMemo(() => {
    const unique = [
      ...new Set(allItems.map((i) => i.category).filter(Boolean)),
    ];
    return unique as string[];
  }, [allItems]);

  const openLaunchFromNubankEntry = (entry: NubankEntry) => {
    if (!reconciliationCreditCardId) {
      toast.error("Selecione o cartão Nubank para lançar esta despesa.");
      return;
    }

    setLaunchInitialValues({
      accountId: reconciliationCreditCardId,
      value: Math.abs(entry.amount),
      date: entry.date,
      category: "",
      note: "",
    });
    setShowLaunchModal(true);
  };

  const findSystemReconciliationItem = (entry: SystemInvoiceEntry) => {
    return (
      allItems.find(
        (candidate) =>
          candidate.monthId === entry.monthId &&
          candidate.transactionId === entry.transactionId,
      ) ||
      allItems.find((candidate) => candidate.id === entry.id) ||
      null
    );
  };

  const openEdit = (item: ExtratoItem) => {
    setEditItem(item);
    setEditValue(formatCurrencyInput(Number(item.value ?? 0)));
    setAnticipateInstallments(false);
    setAnticipationInstallments("");
    setAnticipationPaidValue("");
    setShowEdit(true);
  };

  const openEditFromReconciliation = (entry: SystemInvoiceEntry) => {
    const item = findSystemReconciliationItem(entry);

    if (!item) {
      toast.error("Não encontrei este lançamento para editar.");
      return;
    }

    openEdit(item);
  };

  const askDeleteFromReconciliation = (entry: SystemInvoiceEntry) => {
    const item = findSystemReconciliationItem(entry);

    if (!item) {
      toast.error("Não encontrei este lançamento para excluir.");
      return;
    }

    askDelete(item);
  };

  const editRemainingInstallments =
    editItem?.installmentTotal && editItem?.installmentCurrent
      ? Math.max(editItem.installmentTotal - editItem.installmentCurrent, 0)
      : 0;
  const parsedAnticipationInstallments = anticipationInstallments
    ? Number(anticipationInstallments)
    : 0;
  const anticipationOriginalAmount =
    editItem && parsedAnticipationInstallments > 0
      ? Number(editItem.value || 0) * parsedAnticipationInstallments
      : 0;
  const anticipationPaidAmount = parseCurrency(anticipationPaidValue);
  const anticipationDiscountAmount = Math.max(
    anticipationOriginalAmount - anticipationPaidAmount,
    0,
  );
  const canAnticipateEditItem =
    Boolean(editItem?.installmentGroupId) && editRemainingInstallments > 0;

  const saveEdit = async () => {
    if (!editItem || !editItem.monthId || !editItem.transactionId) return;

    const parsed = parseCurrency(editValue);
    if (Number.isNaN(parsed)) return;

    if (anticipateInstallments) {
      if (!groupId || !editItem.accountId || !editItem.installmentGroupId) {
        toast.error("Nao foi possivel identificar a compra parcelada.");
        return;
      }

      if (
        !Number.isInteger(parsedAnticipationInstallments) ||
        parsedAnticipationInstallments < 1 ||
        parsedAnticipationInstallments > editRemainingInstallments
      ) {
        toast.error(
          "Informe uma quantidade valida de parcelas para antecipar.",
        );
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

    setSaving(true);
    try {
      const userId = editItem.launcherId || editItem.userId || currentUserId;
      await saveCardStatementEdit({
        monthId: editItem.monthId,
        transactionId: editItem.transactionId,
        value: parsed,
        anticipation: anticipateInstallments
          ? {
              groupId,
              installmentGroupId: String(editItem.installmentGroupId),
              currentInstallment: Number(editItem.installmentCurrent || 1),
              installmentsToAnticipate: parsedAnticipationInstallments,
              originalAmount: anticipationOriginalAmount,
              paidAmount: anticipationPaidAmount,
              discountAmount: anticipationDiscountAmount,
              accountId: String(editItem.accountId),
              category: editItem.category,
              note: editItem.note,
              date: editItem.date,
              userId,
              userName: editItem.launcherName || editItem.userName || "",
            }
          : undefined,
      });

      if (anticipateInstallments) {
        await loadExtrato();
      } else {
        setAllItems((prev) =>
          prev.map((item) =>
            item.transactionId === editItem.transactionId &&
            item.monthId === editItem.monthId
              ? { ...item, value: parsed }
              : item,
          ),
        );
      }

      closeEdit();
      toast.success(
        anticipateInstallments
          ? "Antecipação registrada com sucesso."
          : "Lancamento editado com sucesso.",
      );
    } catch (error) {
      console.error("Erro ao editar lançamento:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel editar o lancamento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (item: ExtratoItem) => {
    setItemToDelete(item);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const { requiresReload } = await deleteCardStatementEntry({
      groupId,
      monthId: itemToDelete.monthId,
      transactionId: itemToDelete.transactionId,
      installmentGroupId: itemToDelete.installmentGroupId,
      currentInstallment: itemToDelete.installmentCurrent,
    });

    if (requiresReload) {
      await loadExtrato();
    } else {
      setAllItems((prev) =>
        prev.filter(
          (item) =>
            item.transactionId !== itemToDelete.transactionId ||
            item.monthId !== itemToDelete.monthId,
        ),
      );
    }

    setShowDelete(false);
    setItemToDelete(null);
    toast.success("Lancamento excluido com sucesso.");
  };

  useModalKeyboardActions({
    enabled: showEdit,
    onCancel: closeEdit,
    cancelDisabled: saving,
  });

  useModalKeyboardActions({
    enabled: showDelete,
    onCancel: () => {
      setShowDelete(false);
      setItemToDelete(null);
    },
    onConfirm: confirmDelete,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 px-6 pb-6 text-white">
      <CardStatementHeader
        total={total}
        showValues={showValues}
        formatMoney={formatMoney}
        onToggleValues={() => setShowValues((previous) => !previous)}
        onLaunch={() => {
          setLaunchInitialValues(null);
          setShowLaunchModal(true);
        }}
        onOpenFullStatement={() => router.push(`/extrato-total?monthId=${requestedMonthId}`)}
        onBack={() => router.push("/dashboard")}
      />
      <CardStatementFilters
        monthTitle={monthTitle}
        selectedCreditCardLabel={getSelectedCreditCardLabel()}
        selectedLauncherLabel={getSelectedLauncherLabel()}
        periodLabel={getDateRangeLabel()}
        periodFilter={periodFilter}
        periodOptions={[
          { label: "Fatura atual", value: PERIOD_CURRENT_INVOICE },
          { label: "Este mês", value: PERIOD_THIS_MONTH },
          { label: "Últimos 30 dias", value: PERIOD_LAST_30_DAYS },
        ]}
        showDateRangePicker={showDateRangePicker}
        calendarMonth={calendarMonth}
        filterStartDate={filterStartDate}
        filterEndDate={filterEndDate}
        filterCategory={filterCategory}
        filterLauncher={filterLauncher}
        filterCreditCard={filterCreditCard}
        categories={categories}
        members={groupMembers}
        creditCards={creditCardAccounts}
        allLaunchersValue={ALL_LAUNCHERS}
        allCreditCardsValue={ALL_CREDIT_CARDS}
        formatDateLabel={formatDateLabel}
        renderCalendarMonth={renderCalendarMonth}
        onToggleDateRangePicker={() => setShowDateRangePicker((previous) => !previous)}
        onApplyPeriodFilter={applyPeriodFilter}
        onMoveCalendarMonth={(offset) => setCalendarMonth((current) => addCalendarMonths(current, offset))}
        onClearDateRange={clearDateRange}
        onApplyDateRange={() => setShowDateRangePicker(false)}
        onFilterCategory={setFilterCategory}
        onFilterLauncher={setFilterLauncher}
        onFilterCreditCard={setFilterCreditCard}
        onClearFilters={() => {
          clearDateRange();
          setFilterCategory("");
          setFilterCreditCard(ALL_CREDIT_CARDS);
          setFilterLauncher(currentUserId || ALL_LAUNCHERS);
          setShowDateRangePicker(false);
        }}
      />
      <CardStatementTransactions
        loading={loading}
        groups={groups}
        reconciliationGroups={reconciliationGroups}
        showValues={showValues}
        formatMoney={formatMoney}
        onEdit={openEdit}
        onDelete={askDelete}
        onOpenReconciliation={setReconciliationMonthLabel}
        onCreateMissingEntry={openLaunchFromNubankEntry}
        onEditSystemEntry={openEditFromReconciliation}
        onDeleteSystemEntry={askDeleteFromReconciliation}
      />

      <CardStatementEditDialog
        open={showEdit}
        item={editItem}
        value={editValue}
        saving={saving}
        canAnticipate={canAnticipateEditItem}
        anticipateInstallments={anticipateInstallments}
        remainingInstallments={editRemainingInstallments}
        anticipationInstallments={anticipationInstallments}
        anticipationPaidValue={anticipationPaidValue}
        originalAmount={anticipationOriginalAmount}
        discountAmount={anticipationDiscountAmount}
        formatMoney={formatMoney}
        formatCurrencyTyping={formatCurrencyTyping}
        onValueChange={setEditValue}
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
        onAnticipationInstallmentsChange={setAnticipationInstallments}
        onAnticipationPaidValueChange={setAnticipationPaidValue}
        onSave={saveEdit}
        onClose={closeEdit}
      />
      <CardStatementDeleteDialog
        open={showDelete && Boolean(itemToDelete)}
        isInstallment={Boolean(itemToDelete?.installmentGroupId)}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDelete(false);
          setItemToDelete(null);
        }}
      />
      {activeReconciliationGroup && (
        <InvoiceReconciliationModal
          open={Boolean(activeReconciliationGroup)}
          monthLabel={activeReconciliationGroup.monthLabel}
          monthId={activeMonthId}
          creditCardId={reconciliationCreditCardId}
          systemItems={activeReconciliationGroup.items.map((item) => ({
            id: item.id,
            transactionId: item.transactionId,
            monthId: item.monthId,
            date: item.date,
            value: item.value,
            category: item.category,
            note: item.note,
            accountName: item.accountName,
            installmentCurrent: item.installmentCurrent,
            installmentTotal: item.installmentTotal,
            transactionType: item.transactionType,
          }))}
          onClose={() => setReconciliationMonthLabel(null)}
          onCreateMissingEntry={openLaunchFromNubankEntry}
          onEditSystemEntry={openEditFromReconciliation}
          onDeleteSystemEntry={askDeleteFromReconciliation}
        />
      )}

      <LaunchModal
        open={showLaunchModal}
        onClose={() => {
          setShowLaunchModal(false);
          setLaunchInitialValues(null);
        }}
        monthId={activeMonthId}
        accounts={accounts}
        setAccounts={setAccounts}
        setTransactions={setTransactions}
        initialValues={launchInitialValues}
        onSaved={async (targetMonthId) => {
          if (targetMonthId === activeMonthId) {
            await loadExtrato();
          }
        }}
        onMonthsChanged={async (targetMonthId) => {
          if (targetMonthId !== activeMonthId && !launchInitialValues) {
            router.push(`/extrato?monthId=${targetMonthId}`);
            return;
          }

          await loadExtrato();
        }}
      />
    </div>
  );
}

export default function ExtratoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ExtratoContent />
    </Suspense>
  );
}
