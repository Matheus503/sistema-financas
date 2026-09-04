"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { auth } from "../../lib/auth";
import { getAllMonths } from "../../services/monthService";
import {
  ensureUserProfile,
  getGroupMembers,
  type GroupMemberListItem,
} from "../../services/userService";
import {
  getAccountsByMonth,
  isCreditCardAccount,
} from "../../services/accountService";
import {
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../../services/transactionService";
import {
  anticipateInstallmentPurchase,
  cancelInstallmentPurchaseFromInstallment,
} from "../../services/installmentPurchaseService";
import TransactionList from "../../components/TransactionList";
import InvoiceReconciliationModal from "../../components/InvoiceReconciliationModal";
import LaunchModal from "../../components/LaunchModal";
import SwitchControl from "../../components/SwitchControl";
import { useModalKeyboardActions } from "../../hooks/useModalKeyboardActions";
import type { NubankEntry } from "../../lib/nubankCsvParser";
import type { SystemInvoiceEntry } from "../../lib/invoiceReconciliation";
import type { FinanceAccount } from "../../services/accountService";

type MonthDoc = {
  id: string;
  year: number;
  month: number;
};

type Transaction = {
  id: string;
  accountId?: string;
  date?: string;
  value?: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  transactionType?: string;
};

type ExtratoItem = {
  id: string;
  transactionId: string;
  monthId: string;
  accountId?: string;
  accountName?: string;
  date: string;
  value: number;
  monthLabel: string;
  monthOrder: number;
  note?: string;
  category?: string;
  userId?: string;
  userName?: string;
  launcherId?: string;
  launcherName?: string;
  installmentGroupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  transactionType?: string;
};

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

  const stripInstallmentSuffix = (value: string) =>
    String(value || "")
      .replace(/\s*\(\d+\/\d+\)\s*$/, "")
      .replace(/\s-\s\d+\/\d+\s*$/, "")
      .trim();

  const formatMonthLabel = (month: number, year: number) =>
    `Fatura ${String(month).padStart(2, "0")}/${year}`;

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
    const user = auth.currentUser;
    if (!user) {
      router.push("/");
      return;
    }

    setLoading(true);

    try {
      const profile = await ensureUserProfile(user);
      setGroupId(profile.groupId);
      const [months, members] = await Promise.all([
        getAllMonths(profile.groupId) as Promise<MonthDoc[]>,
        getGroupMembers(profile.groupId),
      ]);

      setGroupMembers(members);

      const targetMonth =
        months.find((m) => m.id === requestedMonthId) ||
        months[months.length - 1];

      if (!targetMonth) {
        setAllItems([]);
        setAccounts([]);
        setTransactions([]);
        setActiveMonthId(null);
        setMonthTitle("Extrato de cartão");
        return;
      }

      const [accounts, transactions] = (await Promise.all([
        getAccountsByMonth(targetMonth.id),
        getTransactions(targetMonth.id),
      ])) as [FinanceAccount[], Transaction[]];

      const creditCardAccounts = accounts.filter((a: FinanceAccount) =>
        isCreditCardAccount(a),
      );

      const creditCardById = new Map(
        creditCardAccounts.map((a: FinanceAccount) => [String(a.id), a]),
      );

      const creditCardIds = new Set(
        creditCardAccounts.map((a: FinanceAccount) => String(a.id)),
      );

      const label = formatMonthLabel(targetMonth.month, targetMonth.year);
      const monthOrder = targetMonth.year * 100 + targetMonth.month;

      setAccounts(accounts as FinanceAccount[]);
      setTransactions(transactions);
      setActiveMonthId(targetMonth.id);

      const items: ExtratoItem[] = [];

      for (const t of transactions || []) {
        if (!t || !t.accountId) continue;
        if (!creditCardIds.has(String(t.accountId))) continue;

        const account = creditCardById.get(String(t.accountId));

        items.push({
          id: `${targetMonth.id}-${t.id || Math.random()}`,
          transactionId: String(t.id),
          monthId: targetMonth.id,
          accountId: String(t.accountId),
          accountName: account?.name || "",
          date: t.date ? String(t.date) : "",
          value: Number(t.value ?? 0),
          monthLabel: label,
          monthOrder,
          note: t.note ? String(t.note) : "",
          category: t.category ? String(t.category) : "",
          userId: t.userId ? String(t.userId) : "",
          userName: t.userName ? String(t.userName) : "",
          launcherId: t.launcherId ? String(t.launcherId) : "",
          launcherName: t.launcherName ? String(t.launcherName) : "",
          installmentGroupId: t.installmentGroupId
            ? String(t.installmentGroupId)
            : "",
          installmentCurrent: t.installmentCurrent
            ? Number(t.installmentCurrent)
            : undefined,
          installmentTotal: t.installmentTotal
            ? Number(t.installmentTotal)
            : undefined,
          transactionType: t.transactionType ? String(t.transactionType) : "",
        });
      }

      items.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (db !== da) return db - da;
        return b.monthOrder - a.monthOrder;
      });

      setMonthTitle(label);
      setAllItems(items);
    } finally {
      setLoading(false);
    }
  }, [requestedMonthId, router]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
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
      await updateTransaction(editItem.monthId, editItem.transactionId, {
        value: parsed,
      });

      if (anticipateInstallments) {
        const userId = editItem.launcherId || editItem.userId || currentUserId;
        const userName = editItem.launcherName || editItem.userName || "";

        await anticipateInstallmentPurchase({
          groupId,
          currentMonthId: editItem.monthId,
          installmentGroupId: String(editItem.installmentGroupId),
          currentInstallment: Number(editItem.installmentCurrent || 1),
          installmentsToAnticipate: parsedAnticipationInstallments,
          originalAmount: anticipationOriginalAmount,
          paidAmount: anticipationPaidAmount,
          discountAmount: anticipationDiscountAmount,
          accountId: String(editItem.accountId),
          category: editItem.category || "Sem categoria",
          baseNote: stripInstallmentSuffix(
            editItem.note || editItem.category || "",
          ),
          date: editItem.date,
          userId,
          userName,
          launcherId: userId,
          launcherName: userName,
        });
      }

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

    if (
      groupId &&
      itemToDelete.installmentGroupId &&
      itemToDelete.installmentCurrent
    ) {
      await cancelInstallmentPurchaseFromInstallment({
        groupId,
        currentMonthId: itemToDelete.monthId,
        installmentGroupId: itemToDelete.installmentGroupId,
        currentInstallment: itemToDelete.installmentCurrent,
      });
    } else {
      await deleteTransaction(itemToDelete.monthId, itemToDelete.transactionId);
    }

    if (
      groupId &&
      itemToDelete.installmentGroupId &&
      itemToDelete.installmentCurrent
    ) {
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
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 px-6 pb-6 pt-[148px] text-white sm:pt-[126px]">
      <div className="fixed left-0 right-0 top-0 z-40 flex flex-col gap-4 border-b border-zinc-700/70 bg-black/75 px-6 pb-4 pt-6 shadow-lg shadow-black/30 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Extrato de cartão</h1>
          <p className="text-zinc-400 text-sm">
            Lançamentos da fatura do mês selecionado
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setLaunchInitialValues(null);
              setShowLaunchModal(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl shadow"
            type="button"
          >
            + Lançar
          </button>

          <button
            onClick={() =>
              router.push(`/extrato-total?monthId=${requestedMonthId}`)
            }
            className="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-xl"
            type="button"
          >
            Extrato completo
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl"
            type="button"
          >
            Voltar
          </button>
        </div>
      </div>

      <div className="bg-purple-800 p-6 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <p className="text-sm text-purple-200">Total do extrato</p>
          <h2 className="text-3xl font-bold">
            {showValues ? formatMoney(total) : "R$ ••••••"}
          </h2>
        </div>

        <button
          onClick={() => setShowValues((prev) => !prev)}
          type="button"
          className="text-3xl leading-none opacity-90 hover:opacity-100 transition"
          aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 3l18 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
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
          )}
        </button>
      </div>

      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="grid gap-3 md:grid-cols-[240px_1fr_1fr_240px_160px] items-end">
          <div className="relative">
            <label className="block text-xs text-zinc-400 mb-2">Período</label>
            <button
              type="button"
              onClick={() => setShowDateRangePicker((prev) => !prev)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg outline-none text-left transition"
            >
              {getDateRangeLabel()}
            </button>

            {showDateRangePicker && (
              <div className="absolute left-0 top-[74px] z-50 w-[min(92vw,640px)] rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Fatura atual", value: PERIOD_CURRENT_INVOICE },
                    { label: "Este mês", value: PERIOD_THIS_MONTH },
                    { label: "Últimos 30 dias", value: PERIOD_LAST_30_DAYS },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => applyPeriodFilter(item.value)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        periodFilter === item.value
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mb-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((current) =>
                        addCalendarMonths(current, -1),
                      )
                    }
                    className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700"
                    aria-label="Mês anterior"
                  >
                    ←
                  </button>

                  <div className="text-xs text-zinc-400">
                    {filterStartDate && !filterEndDate
                      ? "Selecione a data final"
                      : "Selecione a data inicial"}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth((current) =>
                        addCalendarMonths(current, 1),
                      )
                    }
                    className="rounded-lg bg-zinc-800 px-3 py-2 hover:bg-zinc-700"
                    aria-label="Próximo mês"
                  >
                    →
                  </button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {renderCalendarMonth(calendarMonth)}
                  {renderCalendarMonth(addCalendarMonths(calendarMonth, 1))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                  <div className="text-xs text-zinc-400">
                    {filterStartDate
                      ? `${formatDateLabel(filterStartDate)}${
                          filterEndDate
                            ? ` - ${formatDateLabel(filterEndDate)}`
                            : ""
                        }`
                      : "Nenhum período selecionado"}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={clearDateRange}
                      className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                    >
                      Limpar
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDateRangePicker(false)}
                      className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold hover:bg-purple-700"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">
              Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            >
              <option value="">Todas categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">
              Quem lançou
            </label>
            <select
              value={filterLauncher}
              onChange={(e) => setFilterLauncher(e.target.value)}
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            >
              {groupMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {`Lancamentos ${getMemberLabel(member)}`}
                </option>
              ))}
              <option value={ALL_LAUNCHERS}>Todos os Lancamentos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">
              Cartão de crédito
            </label>
            <select
              value={filterCreditCard}
              onChange={(e) => setFilterCreditCard(e.target.value)}
              className="w-full bg-zinc-800 p-2 rounded-lg outline-none"
            >
              <option value={ALL_CREDIT_CARDS}>Todos os cartões</option>
              {creditCardAccounts.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              clearDateRange();
              setFilterCategory("");
              setFilterCreditCard(ALL_CREDIT_CARDS);
              setFilterLauncher(currentUserId || ALL_LAUNCHERS);
              setShowDateRangePicker(false);
            }}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl h-[42px]"
            type="button"
          >
            Limpar filtros
          </button>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Fatura: {monthTitle} - {getSelectedCreditCardLabel()}
          {filterStartDate || filterEndDate
            ? ` • Período: ${getDateRangeLabel()}`
            : ""}
          {filterCategory ? ` • Categoria: ${filterCategory}` : ""}
          {` • ${getSelectedLauncherLabel()}`}
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Carregando...</div>
      ) : groups[0]?.items?.length ? (
        <TransactionList
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
      ) : (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 text-zinc-400">
          Nenhum lançamento encontrado com os filtros atuais.
        </div>
      )}

      {showEdit && editItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
          <form
            className="bg-zinc-900 p-6 rounded-xl w-full max-w-md border border-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              saveEdit();
            }}
          >
            <h2 className="mb-3 text-lg font-bold">Editar valor lançado</h2>

            <p className="text-sm text-zinc-400 mb-3">
              {editItem.category || "Lançamento"}
            </p>

            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-2 bg-zinc-800 rounded mb-3"
              placeholder="Novo valor"
            />

            {canAnticipateEditItem && (
              <div className="mb-4 space-y-3 border-t border-zinc-800 pt-3">
                <SwitchControl
                  checked={anticipateInstallments}
                  label="Antecipar parcelas"
                  onChange={(checked) => {
                    setAnticipateInstallments(checked);

                    if (checked) {
                      setAnticipationInstallments(
                        editRemainingInstallments
                          ? String(editRemainingInstallments)
                          : "",
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
                    <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                      <label className="rounded-lg bg-zinc-800/70 p-3">
                        <span className="block">Antecipar</span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={anticipationInstallments}
                          onChange={(event) => {
                            const nextValue = event.target.value.replace(
                              /\D/g,
                              "",
                            );

                            if (!nextValue) {
                              setAnticipationInstallments("");
                              return;
                            }

                            setAnticipationInstallments(
                              String(
                                Math.min(
                                  Number(nextValue),
                                  editRemainingInstallments,
                                ),
                              ),
                            );
                          }}
                          className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-purple-300 outline-none"
                          placeholder="0"
                        />
                      </label>

                      <div className="rounded-lg bg-zinc-800/70 p-3">
                        <div>Atual</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {editItem.installmentCurrent}/
                          {editItem.installmentTotal}
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-800/70 p-3">
                        <div>Restantes</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {editRemainingInstallments}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                      <label className="rounded-lg bg-zinc-800/70 p-3">
                        <span className="block">Valor pago</span>
                        <input
                          type="tel"
                          inputMode="decimal"
                          value={anticipationPaidValue}
                          onChange={(event) =>
                            setAnticipationPaidValue(
                              formatCurrencyTyping(event.target.value),
                            )
                          }
                          className="mt-1 w-full bg-transparent p-0 text-sm font-semibold text-zinc-100 outline-none"
                          placeholder="R$ 0,00"
                        />
                      </label>

                      <div className="rounded-lg bg-zinc-800/70 p-3">
                        <div>Original</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {formatMoney(anticipationOriginalAmount)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-zinc-800/70 p-3">
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

            <div className="flex justify-between gap-2">
              <button
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                Salvar
              </button>

              <button
                onClick={() => {
                  closeEdit();
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

      {showDelete && itemToDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 p-6 rounded-xl w-80 text-center border border-zinc-800">
            <h2 className="mb-4 text-lg font-bold">
              {itemToDelete.installmentGroupId
                ? "Excluir compra parcelada?"
                : "Deseja excluir este lançamento?"}
            </h2>

            {itemToDelete.installmentGroupId && (
              <p className="mb-5 text-sm text-zinc-400">
                Este lançamento e as próximas parcelas desta compra serão
                removidos. Parcelas de meses anteriores serão mantidas no
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
                  setShowDelete(false);
                  setItemToDelete(null);
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
