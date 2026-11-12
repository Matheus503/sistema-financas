import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, ScrollView, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { User } from "@firebase/auth";
import type { FinanceAccount } from "../../../../../../src/domain/finance/account";
import type { FinanceTransaction } from "../../../../../../src/domain/finance/transaction";
import type { GroupMemberListItem } from "../../../../../../src/domain/finance/groupMember";
import type { UserProfile } from "../../../../../../src/domain/finance/userProfile";
import { getAccountBalanceValue } from "../../../../../../src/domain/finance/accountBalance";
import type { MobileAccountCreationInput, MobileAccountType, MobileCommonAccountUpdate } from "../application/mobileDashboard";
import { formatAccountNameWithDueDay, getCreditCardClosingDay, isCreditCardAccount, isInstallmentAccount, isPixAccount } from "../../../../../../src/domain/finance/account";
import { buildMobileAgendaSections } from "../application/mobileAgenda";
import { useMobileDashboard } from "../hooks/useMobileDashboard";
import CreateMobileAccountModal from "./CreateMobileAccountModal";
import EditMobileAccountModal from "./EditMobileAccountModal";
import MobileLaunchModal from "./MobileLaunchModal";
import EditMobileTransactionModal from "./EditMobileTransactionModal";
import { buildMonthlyReport } from "../../../../../../src/domain/finance/monthlyReport";
import type { SettledAccount } from "../../../../../../src/domain/finance/monthlyReport";
import { localDate } from "../../../../../../src/shared/date";
import { deleteMobileCurrentUserAccount, ensureMobileUserProfile, getMobileGroupMembers, inviteMobileGroupMember, removeMobileGroupMember, setMobileActiveSpace } from "../../../../../../src/features/accounts/application/mobileAccountCommands";

type Props = {
  groupId: string;
  activeSpace: "family" | "personal";
  user: User | null;
  onSignOut: () => void;
};

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatShortMonth = (year: number, month: number) => {
  const label = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ");
  return label.slice(0, 1).toLocaleUpperCase("pt-BR") + label.slice(1);
};

function AccountSection({
  title,
  accounts,
  transactionTotals,
  renderMoney,
  updatingAccountId,
  onTogglePaid,
  accountType,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onShowPixHistory,
}: {
  title: string;
  accounts: FinanceAccount[];
  transactionTotals: Map<string, number>;
  renderMoney: (value: number) => string;
  updatingAccountId: string | null;
  onTogglePaid: (account: FinanceAccount) => void;
  accountType: MobileAccountType;
  onAddAccount: (accountType: MobileAccountType) => void;
  onEditAccount: (account: FinanceAccount) => void;
  onDeleteAccount: (account: FinanceAccount) => void;
  onShowPixHistory: (account: FinanceAccount) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Adicionar conta " + title.toLowerCase()}
          disabled={!!updatingAccountId}
          onPress={() => onAddAccount(accountType)}
          style={styles.addAccountButton}
        >
          <Text style={styles.addAccountText}>+ Adicionar</Text>
        </Pressable>
      </View>
      {!accounts.length ? <Text style={styles.muted}>Nenhuma conta cadastrada.</Text> : null}
      {accounts.map((account) => {
        const value = getAccountBalanceValue(account, transactionTotals);
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={`${account.isPaid ? "Desmarcar" : "Confirmar"} ${account.type === "CREDIT" ? "recebimento de" : "pagamento de"} ${account.name}`} disabled={!!updatingAccountId} onPress={() => onTogglePaid(account)} style={[styles.accountRow, account.isPaid ? styles.paidAccountRow : styles.unpaidAccountRow]} key={account.id}>
            <View style={styles.accountNameWrap}>
              <View style={[styles.accountDot, account.type === "CREDIT" ? styles.creditDot : account.type === "FIXED" ? styles.fixedDot : styles.variableDot]} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Detalhes de ${account.name}`} onPress={(event) => { event.stopPropagation(); if (isPixAccount(account)) onShowPixHistory(account); else if (!isInstallmentAccount(account)) onEditAccount(account); }}>
                <Text style={styles.accountName} numberOfLines={1}>{formatAccountNameWithDueDay(account)}</Text>
              </Pressable>
            </View>
            <View style={styles.accountRowTrailing}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar valor de ${account.name}`} onPress={(event) => { event.stopPropagation(); if (!isCreditCardAccount(account) && !isPixAccount(account) && !isInstallmentAccount(account)) onEditAccount(account); }}>
                <Text style={styles.accountValue}>{renderMoney(value)}</Text>
              </Pressable>
              {!isInstallmentAccount(account) && !isCreditCardAccount(account) && !isPixAccount(account) ? <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${account.name}`} disabled={!!updatingAccountId} onPress={(event) => { event.stopPropagation(); onDeleteAccount(account); }} style={styles.deleteButton}><TrashIcon /></Pressable> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function TrashIcon() {
  return (
    <View style={styles.trashIcon}>
      <View style={styles.trashLid} />
      <View style={styles.trashHandle} />
      <View style={styles.trashBody}>
        <View style={styles.trashLine} />
        <View style={styles.trashLine} />
      </View>
    </View>
  );
}

export default function MobileDashboardScreen({ groupId, activeSpace: initialSpace, user, onSignOut }: Props) {
  const [activeGroupId, setActiveGroupId] = useState(groupId);
  const [activeSpace, setActiveSpace] = useState(initialSpace);
  const dashboard = useMobileDashboard(activeGroupId);
  const [activeView, setActiveView] = useState<"home" | "credits" | "fixed" | "variable" | "agenda" | "monthly-report">("home");
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [members, setMembers] = useState<GroupMemberListItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<GroupMemberListItem | null>(null);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [launcherFilter, setLauncherFilter] = useState(() => user?.uid || "all");
  const [isLauncherPickerOpen, setIsLauncherPickerOpen] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showValues, setShowValues] = useState(true);
  const [newAccountType, setNewAccountType] = useState<MobileAccountType | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<FinanceAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<FinanceAccount | null>(null);
  const [pixAccount, setPixAccount] = useState<FinanceAccount | null>(null);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportSummaryIndex, setReportSummaryIndex] = useState(0);
  const reportSummaryRef = useRef<ScrollView>(null);
  const [monthlyReportData, setMonthlyReportData] = useState<{ accounts: SettledAccount[]; months: { id: string; year: number; month: number }[]; adjustmentsByMonth: Record<string, { investmentCents?: number; goalContributionCents?: number }> } | null>(null);
  const [reportLoadResult, setReportLoadResult] = useState<{ key: string; error: string }>({ key: "", error: "" });
  const [settlementEdit, setSettlementEdit] = useState<{ monthId: string; accountId: string; name: string; type: SettledAccount["type"]; date: string } | null>(null);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<FinanceTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<FinanceTransaction | null>(null);
  const reportRequestKey = `${activeGroupId}:${activeView}`;
  const isReportViewActive = activeView === "monthly-report";
  const reportLoading = isReportViewActive && reportLoadResult.key !== reportRequestKey;
  const reportError = reportLoadResult.key === reportRequestKey ? reportLoadResult.error : "";
  const loadMonthlyReport = dashboard.getMonthlyReport;
  const transactionTotals = dashboard.transactionTotals;
  const { width: screenWidth } = useWindowDimensions();
  const creditCardWidth = screenWidth - 32;
  const renderMoney = (value: number) => showValues ? formatMoney(value) : "R$ ••••••";
  const creditCardAccounts = dashboard.accounts.filter(isCreditCardAccount);
  const creditCardSlides = creditCardAccounts.length > 1
    ? [
        { id: "all", account: null, label: "Total Cartões", detail: "", value: creditCardAccounts.reduce((total, account) => total + getAccountBalanceValue(account, transactionTotals), 0) },
        ...creditCardAccounts.map((account) => ({
          id: account.id,
          account,
          label: account.name,
          detail: `Fecha dia ${getCreditCardClosingDay(account)}${account.dia_vencimento ? ` · Vence dia ${account.dia_vencimento}` : ""}`,
          value: getAccountBalanceValue(account, transactionTotals),
        })),
      ]
    : creditCardAccounts.map((account) => ({
        id: account.id,
        account,
        label: account.name,
        detail: `Fecha dia ${getCreditCardClosingDay(account)}${account.dia_vencimento ? ` · Vence dia ${account.dia_vencimento}` : ""}`,
        value: getAccountBalanceValue(account, transactionTotals),
      }));
  const recentTransactions = [...dashboard.transactions]
    .filter((transaction) => {
      if (launcherFilter === "all") return true;
      const launcherId = transaction.launcherId || transaction.userId;
      if (launcherId && launcherId === launcherFilter) return true;
      const member = dashboard.members.find((item) => item.id === launcherFilter);
      if (!member) return false;
      const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const launcher = normalize(`${transaction.launcherName || ""} ${transaction.userName || ""}`);
      return Boolean(launcher && [member.name, member.email, member.email.split("@")[0]].some((value) => value && launcher.includes(normalize(value))));
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const launcherMember = dashboard.members.find((item) => item.id === launcherFilter);
  const launcherLabel = launcherFilter === "all"
    ? "Todos"
    : launcherMember?.name || launcherMember?.email.split("@")[0] || user?.displayName || user?.email?.split("@")[0] || "Todos";
  const agendaSections = useMemo(
    () => buildMobileAgendaSections(dashboard.accounts, transactionTotals),
    [dashboard.accounts, transactionTotals],
  );
  const canDeleteMembers = members.some((member) => member.id === user?.uid && member.role === "admin");
  useEffect(() => {
    if (!activeGroupId || activeView !== "monthly-report") return;
    let active = true;
    const requestKey = reportRequestKey;
    let errorMessage = "";
    const load = loadMonthlyReport().then((data: NonNullable<typeof monthlyReportData>) => { if (active) setMonthlyReportData(data); });
    void load.catch((loadError) => {
      console.error("Não foi possível carregar o relatório:", loadError);
      errorMessage = "Não foi possível carregar este relatório.";
    }).finally(() => { if (active) setReportLoadResult({ key: requestKey, error: errorMessage }); });
    return () => { active = false; };
  }, [activeView, activeGroupId, loadMonthlyReport, reportRequestKey]);
  const monthlyReport = useMemo(() => monthlyReportData
    ? buildMonthlyReport(monthlyReportData.accounts, monthlyReportData.months, reportYear, undefined, monthlyReportData.adjustmentsByMonth)
    : null, [monthlyReportData, reportYear]);
  const byType = (type: FinanceAccount["type"]) =>
    dashboard.accounts.filter((account) => account.type === type);

  const handleCreateAccount = async (input: MobileAccountCreationInput) => {
    const created = await dashboard.addAccount(input);
    if (created) setNewAccountType(null);
    return created;
  };
  const handleEditAccount = async (account: FinanceAccount, input: MobileCommonAccountUpdate) => {
    const updated = await dashboard.editAccount(account, input);
    if (updated) setAccountToEdit(null);
    return updated;
  };
  const confirmDeleteAccount = (account: FinanceAccount) => setAccountToDelete(account);
  const deleteSelectedAccount = async () => {
    if (!accountToDelete) return;
    if (await dashboard.removeAccount(accountToDelete)) setAccountToDelete(null);
  };
  const accountBusyId = dashboard.updatingAccountId ?? (dashboard.isCreatingAccount ? "creating" : null);
  const closeCreateAccount = () => {
    dashboard.clearAccountMutationError();
    setNewAccountType(null);
  };
  const confirmDeleteTransaction = (transaction: FinanceTransaction) => setTransactionToDelete(transaction);
  const deleteSelectedTransaction = async () => {
    if (!transactionToDelete) return;
    if (await dashboard.removeTransaction(transactionToDelete)) setTransactionToDelete(null);
  };
  const saveSettlementDate = async () => {
    if (!settlementEdit) return;
    const date = settlementEdit.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate()) {
      Alert.alert("Data inválida", "Use o formato AAAA-MM-DD e uma data até hoje.");
      return;
    }
    setSettlementSaving(true);
    try {
      await dashboard.updateSettlementDate(settlementEdit.monthId, settlementEdit.accountId, date);
      const refreshed = await dashboard.getMonthlyReport();
      setMonthlyReportData(refreshed);
      setSettlementEdit(null);
    } catch (saveError) {
      Alert.alert("Não foi possível salvar", saveError instanceof Error ? saveError.message : "Tente novamente.");
    } finally {
      setSettlementSaving(false);
    }
  };
  const formatSettlementDateInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };
  const switchSpace = async () => {
    if (!user) return;
    const nextSpace = activeSpace === "family" ? "personal" : "family";
    setIsProfileMenuOpen(false);
    try {
      await setMobileActiveSpace(user, nextSpace);
      const profile: UserProfile = await ensureMobileUserProfile(user);
      setActiveSpace(nextSpace);
      setActiveGroupId(profile.groupId);
      setActiveView("home");
    } catch (switchError) {
      console.error("Não foi possível alternar o espaço:", switchError);
      Alert.alert("Não foi possível alternar", "Tente novamente.");
    }
  };
  const openMembers = async () => {
    setIsProfileMenuOpen(false);
    setIsMembersOpen(true);
    setIsLoadingMembers(true);
    try {
      setMembers(await getMobileGroupMembers(activeGroupId));
    } catch (membersError) {
      console.error("Não foi possível carregar os membros:", membersError);
      Alert.alert("Não foi possível carregar", "Tente novamente.");
    } finally {
      setIsLoadingMembers(false);
    }
  };
  const saveMember = async () => {
    const normalizedName = memberName.trim();
    const normalizedEmail = memberEmail.trim().toLowerCase();
    if (!user) return;
    if (!normalizedName) return Alert.alert("Dados incompletos", "Informe o nome do membro.");
    if (!normalizedEmail || !normalizedEmail.includes("@")) return Alert.alert("E-mail inválido", "Informe um e-mail válido.");
    setIsSavingMember(true);
    try {
      await inviteMobileGroupMember(normalizedName, normalizedEmail, activeGroupId, user.uid);
      setMembers(await getMobileGroupMembers(activeGroupId));
      setMemberName("");
      setMemberEmail("");
      setIsAddMemberOpen(false);
      Alert.alert("Convite criado", "O membro foi cadastrado com sucesso.");
    } catch (inviteError) {
      console.error("Não foi possível cadastrar o membro:", inviteError);
      Alert.alert("Não foi possível cadastrar", inviteError instanceof Error ? inviteError.message : "Tente novamente.");
    } finally {
      setIsSavingMember(false);
    }
  };
  const deleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeletingMember(true);
    try {
      await removeMobileGroupMember(memberToDelete);
      setMembers(await getMobileGroupMembers(activeGroupId));
      setMemberToDelete(null);
    } catch (removeError) {
      console.error("Não foi possível remover o membro:", removeError);
      Alert.alert("Não foi possível remover", removeError instanceof Error ? removeError.message : "Tente novamente.");
    } finally {
      setIsDeletingMember(false);
    }
  };
  const deleteUserAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const profile: UserProfile = await ensureMobileUserProfile(user);
      await deleteMobileCurrentUserAccount(profile);
      setIsDeleteAccountOpen(false);
      setIsMoreOptionsOpen(false);
      if (profile.personalGroupId && profile.personalGroupId === profile.groupId) {
        const familyProfile: UserProfile = await ensureMobileUserProfile(user);
        setActiveSpace("family");
        setActiveGroupId(familyProfile.groupId);
        setActiveView("home");
        Alert.alert("Espaço pessoal excluído", "Seus dados pessoais foram removidos.");
      } else {
        await onSignOut();
      }
    } catch (deleteError) {
      console.error("Não foi possível excluir a conta:", deleteError);
      Alert.alert("Não foi possível excluir", deleteError instanceof Error ? deleteError.message : "Tente novamente.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" style={styles.menuButton} onPress={() => setIsSideMenuOpen(true)}>
          <Text style={styles.menuButtonText}>☰</Text>
        </Pressable>
        {activeView === "monthly-report" ? <Text style={styles.reportHeaderLabel}>Relatórios</Text> : <View style={styles.monthNav}>
          <Pressable
            accessibilityLabel="Mês anterior"
            style={[styles.navButton, (!dashboard.canGoPrevious || !!accountBusyId) && styles.disabled]}
            disabled={!dashboard.canGoPrevious || !!accountBusyId}
            onPress={() => dashboard.moveMonth(-1)}
          >
            <Text style={styles.navText}>←</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{dashboard.activeMonth ? formatShortMonth(dashboard.activeMonth.year, dashboard.activeMonth.month) : "—"}</Text>
          <Pressable
            accessibilityLabel="Próximo mês"
            style={[styles.navButton, (!dashboard.canGoNext || !!accountBusyId) && styles.disabled]}
            disabled={!dashboard.canGoNext || !!accountBusyId}
            onPress={() => dashboard.moveMonth(1)}
          >
            <Text style={styles.navText}>→</Text>
          </Pressable>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu do usuário" style={styles.avatarButton} onPress={() => setIsProfileMenuOpen(true)}>
          {user?.photoURL ? <Image source={{ uri: user.photoURL }} style={styles.avatarImage} alt="Foto do perfil" /> : <Text style={styles.avatarText}>{(user?.displayName || user?.email || "C").slice(0, 1).toUpperCase()}</Text>}
        </Pressable>
      </View>

      {dashboard.error ? <Text style={styles.error}>{dashboard.error}</Text> : null}
      {dashboard.accountMutationError && !newAccountType ? <Text style={styles.error}>{dashboard.accountMutationError}</Text> : null}
      {dashboard.isLoading ? <Text style={styles.muted}>Carregando mês…</Text> : null}

      {dashboard.activeMonth && !dashboard.isLoading && !dashboard.error ? (
        <>
          {activeView === "home" ? (
            <>
              {creditCardSlides.length ? (
                <View>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => setActiveCardIndex(Math.round(event.nativeEvent.contentOffset.x / creditCardWidth))}
                  >
                    {creditCardSlides.map((slide) => (
                      <View key={slide.id} style={[styles.creditCardSlide, { width: creditCardWidth }]}>
                        <View style={styles.creditCardTop}>
                          <Pressable accessibilityRole={slide.account ? "button" : undefined} onPress={() => { if (slide.account) setAccountToEdit(slide.account); }} style={styles.creditCardLabels}>
                            <Text numberOfLines={1} style={styles.creditCardTitle}>{slide.label}</Text>
                            {slide.detail ? <Text numberOfLines={1} style={styles.creditCardDetail}>{slide.detail}</Text> : null}
                          </Pressable>
                          <Pressable accessibilityRole="button" accessibilityLabel={showValues ? "Ocultar valores" : "Mostrar valores"} onPress={() => setShowValues((current) => !current)} style={styles.eyeButton}>
                            <View style={styles.eyeIcon}>
                              <View style={styles.eyeShape}><View style={styles.eyePupil} /></View>
                              {!showValues ? <View style={styles.eyeSlash} /> : null}
                            </View>
                          </Pressable>
                        </View>
                        <Text style={styles.creditCardValue}>{renderMoney(slide.value)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  {creditCardSlides.length > 1 ? (
                    <View style={styles.carouselDots}>
                      {creditCardSlides.map((slide, index) => <View key={slide.id} style={[styles.carouselDot, activeCardIndex === index && styles.carouselDotActive]} />)}
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.creditCardSlide}>
                  <Text style={styles.creditCardTitle}>Nenhum cartão de crédito</Text>
                  <Text style={styles.creditCardDetail}>Cadastre um cartão para acompanhar o total aqui.</Text>
                </View>
              )}

              <View style={styles.section}>
                <View style={styles.transactionsHeader}>
                  <Text style={styles.transactionsTitle}>Últimos lançamentos</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Filtrar lançamentos por membro" onPress={() => setIsLauncherPickerOpen(true)} style={styles.memberChip}>
                    <Text numberOfLines={1} style={styles.memberChipText}>{launcherLabel}⌄</Text>
                  </Pressable>
                </View>
                {recentTransactions.length ? recentTransactions.map((transaction) => {
                  const launcher = transaction.launcherName || transaction.userName || "";
                  return (
                    <View style={styles.recentTransactionRow} key={transaction.id}>
                      <Text style={styles.recentTransactionTitle} numberOfLines={1}>
                        {transaction.category || "Sem categoria"} · {formatDate(transaction.date)}
                      </Text>
                      <View style={styles.recentTransactionSubrow}>
                        <Text style={styles.recentTransactionNote} numberOfLines={1}>
                          {launcher ? `${launcher.split("@")[0].split(" ")[0]}${transaction.note ? ` - ${transaction.note}` : ""}` : transaction.note || ""}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Editar valor ${formatMoney(Number(transaction.value || 0))}`}
                          onPress={() => setTransactionToEdit(transaction)}
                        >
                          <Text style={styles.recentTransactionValue}>{renderMoney(Number(transaction.value || 0))}</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Excluir lançamento" onPress={() => confirmDeleteTransaction(transaction)} style={styles.transactionTrashButton}>
                          <TrashIcon />
                        </Pressable>
                      </View>
                    </View>
                  );
                }) : <Text style={styles.muted}>Nenhum lançamento ainda</Text>}
              </View>

            </>
          ) : activeView === "agenda" ? (
            agendaSections.map((section) => (
              <View style={styles.section} key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.groups.length ? section.groups.map((group) => (
                  <View style={styles.agendaGroup} key={group.day}>
                    <View style={styles.row}>
                      <Text style={styles.accountName}>{group.day === 32 ? "Sem data definida" : `Dia ${group.day}`}</Text>
                      <Text style={styles.muted}>Total: {renderMoney(group.total)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.agendaLabel}>{section.isCredit ? "A receber" : "Falta pagar"}</Text>
                      <Text style={[styles.accountValue, section.isCredit ? styles.creditValue : styles.expenseValue]}>{renderMoney(group.pending)}</Text>
                    </View>
                    <Text style={styles.muted}>{section.isCredit ? "Recebido" : "Pago"}: {renderMoney(group.total - group.pending)}</Text>
                  </View>
                )) : <Text style={styles.muted}>{section.isCredit ? "Nenhum crédito pendente de recebimento neste mês." : "Nenhum pagamento pendente neste mês."}</Text>}
              </View>
            ))
          ) : ["credits", "fixed", "variable"].includes(activeView) ? (
            <>
              {(() => {
                const config = activeView === "credits"
                  ? { type: "CREDIT" as const, title: "Créditos", totalLabel: "Total de créditos", empty: "Nenhum crédito cadastrado" }
                  : activeView === "fixed"
                    ? { type: "FIXED" as const, title: "Contas Fixas", totalLabel: "Total de contas fixas", empty: "Nenhuma conta fixa cadastrada" }
                    : { type: "VARIABLE" as const, title: "Contas Variáveis", totalLabel: "Total de contas variáveis", empty: "Nenhuma conta variável cadastrada" };
                const accounts = byType(config.type).sort((a, b) => Number(a.dia_vencimento || 999) - Number(b.dia_vencimento || 999) || a.name.localeCompare(b.name));
                const total = accounts.reduce((sum, account) => sum + getAccountBalanceValue(account, transactionTotals), 0);
                return <>
                  <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                      <Text style={styles.balanceLabel}>{config.totalLabel}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={showValues ? "Ocultar valores" : "Mostrar valores"} onPress={() => setShowValues((current) => !current)} style={styles.eyeButton}>
                        <View style={styles.eyeIcon}><View style={styles.eyeShape}><View style={styles.eyePupil} /></View>{!showValues ? <View style={styles.eyeSlash} /> : null}</View>
                      </Pressable>
                    </View>
                    <Text style={styles.balanceValue}>{renderMoney(total)}</Text>
                  </View>
                  <AccountSection title={config.title} accountType={config.type} accounts={accounts} transactionTotals={transactionTotals} renderMoney={renderMoney} updatingAccountId={accountBusyId} onTogglePaid={dashboard.toggleAccountPaid} onAddAccount={setNewAccountType} onEditAccount={setAccountToEdit} onDeleteAccount={confirmDeleteAccount} onShowPixHistory={setPixAccount} />
                </>;
              })()}
            </>
          ) : activeView === "monthly-report" ? (
            <View style={styles.reportWrap}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>Recebimentos e gastos mensais</Text>
                <View style={styles.reportYearNav}>
                  <Pressable onPress={() => setReportYear((year) => year - 1)} style={styles.reportYearButton}><Text style={styles.navText}>‹</Text></Pressable>
                  <Text style={styles.reportYear}>{reportYear}</Text>
                  <Pressable onPress={() => setReportYear((year) => year + 1)} style={styles.reportYearButton}><Text style={styles.navText}>›</Text></Pressable>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={showValues ? "Ocultar valores" : "Mostrar valores"} onPress={() => setShowValues((current) => !current)} style={styles.eyeButton}><View style={styles.eyeIcon}><View style={styles.eyeShape}><View style={styles.eyePupil} /></View>{!showValues ? <View style={styles.eyeSlash} /> : null}</View></Pressable>
              </View>
              {reportLoading ? <Text style={styles.muted}>Carregando relatório…</Text> : null}
              {reportError ? <Text style={styles.error}>{reportError}</Text> : null}
              {monthlyReport ? (
                <>
                  <ScrollView ref={reportSummaryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportCards} onMomentumScrollEnd={(event) => setReportSummaryIndex(Math.max(0, Math.min(2, Math.round(event.nativeEvent.contentOffset.x / creditCardWidth))))}>
                    <ReportValue width={creditCardWidth} label="Recebido em média" value={monthlyReport.averages.received || 0} renderMoney={renderMoney} />
                    <ReportValue width={creditCardWidth} label="Gasto médio" value={monthlyReport.averages.paid || 0} subtitle={`Fixas ${renderMoney(monthlyReport.averages.fixed || 0)} | Variáveis ${renderMoney(monthlyReport.averages.variable || 0)}\nInvestimentos ${renderMoney(monthlyReport.averages.investment || 0)} | Objetivos ${renderMoney(monthlyReport.averages.goalContribution || 0)}`} renderMoney={renderMoney} />
                    <ReportValue width={creditCardWidth} label="Saldo médio" value={monthlyReport.averages.balance || 0} renderMoney={renderMoney} />
                  </ScrollView>
                  <View style={styles.carouselDots}>{[0, 1, 2].map((index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Mostrar média ${index + 1} de 3`} onPress={() => { setReportSummaryIndex(index); reportSummaryRef.current?.scrollTo({ x: creditCardWidth * index, animated: true }); }}><View style={[styles.carouselDot, reportSummaryIndex === index && styles.carouselDotActive]} /></Pressable>)}</View>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Comparação mês a mês</Text>
                    {monthlyReport.rows.length ? monthlyReport.rows.map((row) => (
                      <View key={row.month} style={styles.reportRow}>
                        <View style={styles.reportMonthTitle}><Text style={styles.accountName}>{row.name}</Text><Text style={styles.muted}>{row.status === "current" ? "Em andamento" : ""}</Text></View>
                        <Text style={styles.reportMetric}>Entrou {renderMoney(row.received)}</Text>
                        <Text style={styles.reportMetric}>Saiu {renderMoney(row.paid)}</Text>
                        <Text style={styles.reportMetric}>Saldo {renderMoney(row.balance)}</Text>
                        <Text style={styles.reportSubmetric}>Fixas {renderMoney(row.fixed)} · Variáveis {renderMoney(row.variable)}</Text>
                        {row.entries.map((entry) => (
                          <Pressable key={`${entry.monthId}-${entry.accountId}`} style={styles.dateEntry} onPress={() => setSettlementEdit({ monthId: entry.monthId, accountId: entry.accountId, name: entry.name, type: entry.type, date: entry.paidOn || `${reportYear}-${String(row.month).padStart(2, "0")}-01` })}>
                            <View style={styles.dateEntryMain}><Text style={styles.dateEntryText}>{entry.name}</Text><Text style={styles.reportSubmetric}>{entry.type === "CREDIT" ? "Crédito" : entry.type === "FIXED" ? "Fixa" : "Variável"} · {renderMoney(entry.value)}</Text></View><Text style={styles.dateEntryText}>{entry.paidOn ? "Corrigir data" : "Informar data"}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )) : <Text style={styles.muted}>Nenhum mês com movimentação para este ano.</Text>}
                    <View style={[styles.reportRow, styles.reportTotalRow]}><Text style={styles.accountName}>Total realizado</Text><Text style={styles.reportMetric}>Entrou {renderMoney(monthlyReport.totals.received)}</Text><Text style={styles.reportMetric}>Saiu {renderMoney(monthlyReport.totals.paid)}</Text><Text style={styles.reportMetric}>Saldo {renderMoney(monthlyReport.totals.balance)}</Text></View>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <Modal visible={isSideMenuOpen} transparent animationType="fade" onRequestClose={() => setIsSideMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setIsSideMenuOpen(false)} />
          <View style={styles.sideMenu}>
            <View style={styles.menuHeading}>
              <Text style={styles.menuTitle}>Menu</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => setIsSideMenuOpen(false)}><Text style={styles.menuClose}>×</Text></Pressable>
            </View>
            {([
              ["home", "Início"],
              ["credits", "Créditos"],
              ["agenda", "Agenda financeira"],
              ["fixed", "Contas Fixas"],
              ["variable", "Contas Variáveis"],
            ] as const).map(([view, label]) => (
              <Pressable key={view} style={[styles.menuItem, activeView === view && styles.menuItemActive]} onPress={() => { setActiveView(view); setIsSideMenuOpen(false); }}>
                <Text style={styles.menuItemText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={isProfileMenuOpen} transparent animationType="fade" onRequestClose={() => setIsProfileMenuOpen(false)}>
        <View style={styles.profileMenuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setIsProfileMenuOpen(false)} />
          <View style={styles.profileMenu}>
            <Pressable accessibilityRole="button" onPress={switchSpace} style={styles.profileMenuItem}>
              <Text style={styles.menuItemText}>{activeSpace === "personal" ? "Família" : "Pessoal"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openMembers} style={styles.profileMenuItem}>
              <Text style={styles.menuItemText}>Membros</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setIsProfileMenuOpen(false); setIsMoreOptionsOpen(true); }} style={styles.profileMenuItem}>
              <Text style={styles.menuItemText}>Mais opções</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setIsProfileMenuOpen(false); onSignOut(); }} style={styles.profileMenuItem}>
              <Text style={styles.menuItemText}>Sair</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={isMembersOpen} transparent animationType="fade" onRequestClose={() => setIsMembersOpen(false)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.accountDialog}>
            <View style={styles.sectionHeader}>
              <Text style={styles.dialogTitle}>Membros</Text>
              <View style={styles.dialogHeaderActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar membro" onPress={() => { setMemberName(""); setMemberEmail(""); setIsAddMemberOpen(true); }} style={styles.addAccountButton}>
                  <Text style={styles.addAccountText}>+</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setIsMembersOpen(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Fechar</Text>
                </Pressable>
              </View>
            </View>
            {isLoadingMembers ? <Text style={styles.muted}>Carregando...</Text> : members.length === 0 ? <Text style={styles.muted}>Nenhum membro encontrado.</Text> : (
              <ScrollView style={styles.memberList}>
                {members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberRow}>
                      <Text numberOfLines={1} style={styles.memberName}>{member.name || member.email.split("@")[0]}</Text>
                      <View style={styles.dialogHeaderActions}>
                        {member.role === "admin" ? <Text style={styles.memberBadge}>Admin</Text> : null}
                        {member.status === "pending" ? <Text style={styles.pendingBadge}>Pendente</Text> : null}
                        {canDeleteMembers && member.role !== "admin" ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover membro ${member.name || member.email}`} onPress={() => setMemberToDelete(member)} style={styles.deleteButton}><TrashIcon /></Pressable> : null}
                      </View>
                    </View>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isAddMemberOpen} transparent animationType="fade" onRequestClose={() => { if (!isSavingMember) setIsAddMemberOpen(false); }}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.accountDialog}>
            <Text style={styles.dialogTitle}>Cadastrar membro</Text>
            <TextInput value={memberName} onChangeText={setMemberName} placeholder="Nome" placeholderTextColor="#71717a" editable={!isSavingMember} style={styles.dialogInput} />
            <TextInput value={memberEmail} onChangeText={setMemberEmail} placeholder="email@exemplo.com" placeholderTextColor="#71717a" keyboardType="email-address" autoCapitalize="none" editable={!isSavingMember} style={styles.dialogInput} />
            <View style={styles.dialogHeaderActions}>
              <Pressable accessibilityRole="button" disabled={isSavingMember} onPress={saveMember} style={styles.primaryDialogButton}><Text style={styles.primaryDialogText}>{isSavingMember ? "Salvando..." : "Salvar"}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={isSavingMember} onPress={() => setIsAddMemberOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(memberToDelete)} transparent animationType="fade" onRequestClose={() => { if (!isDeletingMember) setMemberToDelete(null); }}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.accountDialog}>
            <Text style={styles.dialogTitle}>Remover membro</Text>
            <Text style={styles.muted}>Deseja remover {memberToDelete?.name || memberToDelete?.email.split("@")[0]} do grupo?</Text>
            <View style={styles.dialogHeaderActions}>
              <Pressable accessibilityRole="button" disabled={isDeletingMember} onPress={deleteMember} style={styles.dangerDialogButton}><Text style={styles.dangerDialogText}>{isDeletingMember ? "Removendo..." : "Remover"}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={isDeletingMember} onPress={() => setMemberToDelete(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isMoreOptionsOpen} transparent animationType="fade" onRequestClose={() => setIsMoreOptionsOpen(false)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.accountDialog}>
            <View style={styles.sectionHeader}>
              <Text style={styles.dialogTitle}>Mais opções</Text>
              <Pressable accessibilityRole="button" onPress={() => setIsMoreOptionsOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Fechar</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setIsMoreOptionsOpen(false); setIsDeleteAccountOpen(true); }} style={styles.dangerDialogButton}>
              <Text style={styles.dangerDialogText}>Excluir conta</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={isDeleteAccountOpen} transparent animationType="fade" onRequestClose={() => { if (!isDeletingAccount) setIsDeleteAccountOpen(false); }}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.accountDialog}>
            <Text style={styles.dialogTitle}>Excluir conta permanentemente</Text>
            <Text style={styles.muted}>Esta ação excluirá permanentemente sua conta do sistema financeiro. Se você for administrador de um grupo, todos os dados desse grupo serão apagados, incluindo meses, contas, lançamentos, categorias, convites e membros. Esta ação não pode ser desfeita.</Text>
            <View style={styles.dialogHeaderActions}>
              <Pressable accessibilityRole="button" disabled={isDeletingAccount} onPress={deleteUserAccount} style={styles.dangerDialogButton}><Text style={styles.dangerDialogText}>{isDeletingAccount ? "Excluindo..." : "Excluir conta"}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={isDeletingAccount} onPress={() => setIsDeleteAccountOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isLauncherPickerOpen} transparent animationType="fade" onRequestClose={() => setIsLauncherPickerOpen(false)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModal}>
            <Text style={styles.sectionTitle}>Quem lançou</Text>
            {[{ id: "all", name: "Todos", email: "" }, ...dashboard.members].map((member) => (
              <Pressable key={member.id} onPress={() => { setLauncherFilter(member.id); setIsLauncherPickerOpen(false); }} style={[styles.classifyingAccount, launcherFilter === member.id && styles.classifyingAccountSelected]}>
                <Text style={styles.accountName}>{member.name || member.email?.split("@")[0] || member.id}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setIsLauncherPickerOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Fechar</Text></Pressable>
          </View>
        </View>
      </Modal>

      <CreateMobileAccountModal
        key={newAccountType || "closed"}
        visible={Boolean(newAccountType)}
        type={newAccountType}
        busy={dashboard.isCreatingAccount}
        error={dashboard.accountMutationError}
        onClose={closeCreateAccount}
        onCreate={handleCreateAccount}
      />
      {accountToEdit ? <EditMobileAccountModal
        key={accountToEdit.id}
        account={accountToEdit}
        busy={Boolean(dashboard.updatingAccountId)}
        error={dashboard.accountMutationError}
        onClose={() => { dashboard.clearAccountMutationError(); setAccountToEdit(null); }}
        onSave={(input) => accountToEdit ? handleEditAccount(accountToEdit, input) : Promise.resolve(false)}
      /> : null}
      <Modal visible={Boolean(accountToDelete)} transparent animationType="fade" onRequestClose={() => { if (!dashboard.updatingAccountId) setAccountToDelete(null); }}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.deleteTransactionModal}>
            <Text style={styles.deleteTransactionTitle}>Excluir conta?</Text>
            <Text style={styles.muted}>{accountToDelete ? `Deseja realmente excluir ${accountToDelete.name}?` : ""}</Text>
            {dashboard.accountMutationError ? <Text style={styles.error}>{dashboard.accountMutationError}</Text> : null}
            <View style={styles.deleteTransactionActions}>
              <Pressable disabled={Boolean(dashboard.updatingAccountId)} onPress={() => void deleteSelectedAccount()} style={[styles.confirmDeleteButton, dashboard.updatingAccountId && styles.disabled]}><Text style={styles.confirmDeleteText}>{dashboard.updatingAccountId ? "Excluindo…" : "Excluir"}</Text></Pressable>
              <Pressable disabled={Boolean(dashboard.updatingAccountId)} onPress={() => setAccountToDelete(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(pixAccount)} transparent animationType="fade" onRequestClose={() => setPixAccount(null)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.pixHistoryModal}>
            <View style={styles.transactionsHeader}>
              <View>
                <Text style={styles.sectionTitle}>Histórico PIX</Text>
                <Text style={styles.muted}>Total: {renderMoney(Number(pixAccount?.value || 0))}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setPixAccount(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Fechar</Text></Pressable>
            </View>
            {dashboard.transactions.filter((transaction) => transaction.accountId === pixAccount?.id).length ? (
              <ScrollView style={styles.pixHistoryList}>
                {dashboard.transactions.filter((transaction) => transaction.accountId === pixAccount?.id).map((transaction) => (
                  <View style={styles.pixHistoryRow} key={transaction.id}>
                    <Text style={styles.recentTransactionTitle}>{transaction.category || "Sem categoria"} · {formatDate(transaction.date)}</Text>
                    <View style={styles.recentTransactionSubrow}>
                      <Text style={styles.recentTransactionNote}>{transaction.launcherName || transaction.userName || ""}{transaction.note ? ` · ${transaction.note}` : ""}</Text>
                      <Pressable accessibilityRole="button" onPress={() => setTransactionToEdit(transaction)}><Text style={styles.recentTransactionValue}>{renderMoney(Number(transaction.value || 0))}</Text></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Excluir lançamento PIX" onPress={() => confirmDeleteTransaction(transaction)}><Text style={styles.deleteButtonText}>×</Text></Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : <Text style={styles.muted}>Nenhum lançamento PIX encontrado neste mês.</Text>}
          </View>
        </View>
      </Modal>
      {isLaunchModalOpen ? <MobileLaunchModal
        key="new-launch"
        user={user}
        accounts={byType("VARIABLE")}
        categories={dashboard.categories}
        busy={dashboard.isCreatingTransaction}
        error={dashboard.transactionMutationError}
        onClose={() => { dashboard.clearTransactionMutationError(); setIsLaunchModalOpen(false); }}
        onSave={dashboard.addTransaction}
      /> : null}
      {transactionToEdit ? <EditMobileTransactionModal
        key={transactionToEdit.id}
        transaction={transactionToEdit}
        busy={dashboard.isCreatingTransaction}
        error={dashboard.transactionMutationError}
        onClose={() => { setTransactionToEdit(null); dashboard.clearTransactionMutationError(); }}
        onSave={(value) => transactionToEdit ? dashboard.editTransaction(transactionToEdit, value) : Promise.resolve(false)}
      /> : null}
      <Modal visible={Boolean(transactionToDelete)} transparent animationType="fade" onRequestClose={() => { if (!dashboard.isCreatingTransaction) setTransactionToDelete(null); }}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.deleteTransactionModal}>
            <Text style={styles.deleteTransactionTitle}>{transactionToDelete?.installmentGroupId && transactionToDelete.installmentCurrent ? "Excluir compra parcelada?" : "Excluir lançamento"}</Text>
            <Text style={styles.muted}>{transactionToDelete?.installmentGroupId && transactionToDelete.installmentCurrent ? "Este lançamento e as próximas parcelas desta compra serão removidos. Parcelas de meses anteriores serão mantidas no histórico." : "Deseja realmente excluir este lançamento?"}</Text>
            {dashboard.transactionMutationError ? <Text style={styles.error}>{dashboard.transactionMutationError}</Text> : null}
            <View style={styles.deleteTransactionActions}>
              <Pressable disabled={dashboard.isCreatingTransaction} onPress={() => void deleteSelectedTransaction()} style={[styles.confirmDeleteButton, dashboard.isCreatingTransaction && styles.disabled]}><Text style={styles.confirmDeleteText}>{dashboard.isCreatingTransaction ? "Excluindo…" : "Confirmar"}</Text></Pressable>
              <Pressable disabled={dashboard.isCreatingTransaction} onPress={() => setTransactionToDelete(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(settlementEdit)} transparent animationType="fade" onRequestClose={() => setSettlementEdit(null)}>
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModal}>
            <Text style={styles.sectionTitle}>{settlementEdit?.type === "CREDIT" ? "Data do Recebimento" : "Data do Pagamento"}</Text>
            <Text style={styles.muted}>{settlementEdit?.name}</Text>
            <TextInput accessibilityLabel="Data do recebimento ou pagamento" value={settlementEdit?.date || ""} onChangeText={(date) => setSettlementEdit((current) => current ? { ...current, date: formatSettlementDateInput(date) } : current)} placeholder="AAAA-MM-DD" placeholderTextColor="#71717a" keyboardType="number-pad" maxLength={10} style={styles.dateInput} />
            <View style={styles.dateModalActions}>
              <Pressable onPress={() => setSettlementEdit(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <Pressable onPress={() => void saveSettlementDate()} disabled={settlementSaving} style={styles.saveButton}><Text style={styles.saveText}>{settlementSaving ? "Salvando…" : "Salvar data"}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
      {activeView !== "monthly-report" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Novo lançamento"
          style={styles.floatingAddButton}
          onPress={() => { dashboard.clearTransactionMutationError(); setIsLaunchModalOpen(true); }}
        >
          <Text style={styles.floatingAddText}>+</Text>
        </Pressable>
      ) : null}
      {activeView === "agenda" ? (
        <Pressable accessibilityRole="button" accessibilityLabel={showValues ? "Ocultar todos os valores" : "Mostrar todos os valores"} onPress={() => setShowValues((current) => !current)} style={styles.floatingEyeButton}>
          <View style={styles.eyeIcon}><View style={styles.eyeShape}><View style={styles.eyePupil} /></View>{!showValues ? <View style={styles.eyeSlash} /> : null}</View>
        </Pressable>
      ) : null}
    </View>
  );
}
function ReportValue({ label, value, subtitle, width, renderMoney }: { label: string; value: number; subtitle?: string; width: number; renderMoney: (value: number) => string }) {
  return <View style={[styles.reportValueCard, { width }]}><Text style={styles.muted}>{label}</Text><Text style={styles.reportValue}>{renderMoney(value)}</Text>{subtitle ? <Text style={styles.reportSubmetric}>{subtitle}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#09090b" },
  scrollView: { flex: 1, width: "100%" },
  container: { flexGrow: 1, backgroundColor: "#09090b", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 110, gap: 20 },
  header: { height: 76, marginHorizontal: -16, paddingHorizontal: 18, paddingBottom: 12, borderBottomColor: "#27272a", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { height: 38, width: 5, borderRadius: 4, backgroundColor: "#a855f7" },
  title: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  brandCaption: { color: "#a1a1aa", fontSize: 12, marginTop: 1 },
  muted: { color: "#a1a1aa", fontSize: 13 },
  avatarButton: { backgroundColor: "#6b21a8", borderRadius: 22, height: 40, width: 40, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "#c084fc55" },
  avatarImage: { height: 40, width: 40 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  signOutButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#18181b", borderRadius: 22, padding: 4, paddingRight: 12, borderWidth: 1, borderColor: "#29292f" },
  signOutText: { color: "#d4d4d8", fontSize: 12, fontWeight: "600" },
  monthNav: { alignSelf: "center", minWidth: 190, maxWidth: 220, flex: 1, marginHorizontal: 14, backgroundColor: "#18181b", borderRadius: 26, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportHeaderLabel: { flex: 1, textAlign: "center", color: "#fafafa", fontSize: 15, fontWeight: "700" },
  viewSelector: { flexDirection: "row", backgroundColor: "#18181b", borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: "#27272a" },
  viewButton: { flex: 1, alignItems: "center", borderRadius: 9, paddingVertical: 11, paddingHorizontal: 8 },
  activeViewButton: { backgroundColor: "#6b21a8" },
  viewButtonText: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  navButton: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  navText: { color: "#fafafa", fontSize: 21, lineHeight: 26 },
  menuButton: { height: 46, width: 46, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#18181b", borderColor: "#27272a", borderWidth: 1 },
  menuButtonText: { color: "#e4e4e7", fontSize: 22, lineHeight: 25 },
  monthLabel: { flex: 1, color: "#fafafa", fontSize: 15, fontWeight: "700", textAlign: "center", textTransform: "capitalize" },
  creditCardSlide: { height: 125, marginTop: 18, borderRadius: 19, backgroundColor: "#5b3175", paddingHorizontal: 18, paddingVertical: 15, justifyContent: "space-between" },
  creditCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  creditCardLabels: { flex: 1, gap: 5 },
  creditCardTitle: { color: "#fff", fontSize: 14, fontWeight: "500" },
  creditCardDetail: { color: "#e9d5ff", opacity: 0.85, fontSize: 11 },
  creditCardValue: { color: "#fff", fontSize: 31, fontWeight: "700", lineHeight: 36 },
  carouselDots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  carouselDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#52525b" },
  carouselDotActive: { backgroundColor: "#c084fc", width: 18 },
  transactionsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  transactionsTitle: { flex: 1, color: "#a1a1aa", fontSize: 14 },
  memberChip: { maxWidth: 150, overflow: "hidden", backgroundColor: "#27272a", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 18, paddingVertical: 6, paddingHorizontal: 10 },
  memberChipText: { color: "#f4f4f5", fontSize: 12 },
  recentTransactionRow: { borderBottomColor: "#27272a", borderBottomWidth: 1, paddingBottom: 10, gap: 5 },
  recentTransactionTitle: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  recentTransactionSubrow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recentTransactionNote: { flex: 1, color: "#71717a", fontSize: 12 },
  recentTransactionValue: { color: "#fb7185", fontSize: 14, fontWeight: "700" },
  transactionTrashButton: { minWidth: 22, minHeight: 26, alignItems: "center", justifyContent: "center" },
  trashIcon: { width: 16, height: 17, alignItems: "center", justifyContent: "flex-end" },
  trashLid: { position: "absolute", top: 3, width: 12, height: 1.5, borderRadius: 1, backgroundColor: "#71717a" },
  trashHandle: { position: "absolute", top: 1, width: 5, height: 1.5, borderTopLeftRadius: 1, borderTopRightRadius: 1, backgroundColor: "#71717a" },
  trashBody: { width: 10, height: 11, borderWidth: 1.4, borderTopWidth: 0, borderColor: "#71717a", borderBottomLeftRadius: 2, borderBottomRightRadius: 2, flexDirection: "row", justifyContent: "center", gap: 2, paddingTop: 2 },
  trashLine: { width: 1, height: 6, backgroundColor: "#71717a" },
  deleteTransactionModal: { width: "100%", maxWidth: 380, backgroundColor: "#18181b", borderRadius: 16, borderWidth: 1, borderColor: "#29292f", padding: 20, gap: 10 },
  deleteTransactionTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  deleteTransactionActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  confirmDeleteButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#7f1d1d", borderWidth: 1, borderColor: "#ef44444d" },
  confirmDeleteText: { color: "#fecaca", fontSize: 13, fontWeight: "700" },
  floatingAddButton: { position: "absolute", right: 24, bottom: 24, height: 76, width: 76, borderRadius: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#653580", elevation: 8 },
  floatingAddText: { color: "#fff", fontSize: 34, lineHeight: 38, fontWeight: "400" },
  floatingEyeButton: { position: "absolute", left: 24, bottom: 36, height: 48, width: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#18181be8", borderColor: "#3f3f46", borderWidth: 1, elevation: 7 },
  menuOverlay: { flex: 1, flexDirection: "row", backgroundColor: "#0009" },
  menuBackdrop: { ...StyleSheet.absoluteFill },
  sideMenu: { width: 288, maxWidth: "82%", height: "100%", backgroundColor: "#09090b", borderRightColor: "#27272a", borderRightWidth: 1, padding: 20, paddingTop: 56, gap: 9 },
  menuHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  menuTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  menuClose: { color: "#a1a1aa", fontSize: 28, lineHeight: 30 },
  menuItem: { borderRadius: 12, backgroundColor: "#18181b", borderColor: "#27272a", borderWidth: 1, paddingVertical: 14, paddingHorizontal: 15 },
  menuItemActive: { backgroundColor: "#3b1d4c", borderColor: "#6b21a8" },
  menuItemText: { color: "#f4f4f5", fontSize: 14, fontWeight: "600" },
  profileMenuOverlay: { flex: 1, alignItems: "flex-end", paddingTop: 62, paddingRight: 16 },
  profileMenu: { minWidth: 180, backgroundColor: "#18181b", borderColor: "#27272a", borderWidth: 1, borderRadius: 12, padding: 8, elevation: 8 },
  profileMenuItem: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  accountDialog: { width: "100%", maxWidth: 380, maxHeight: "82%", backgroundColor: "#18181b", borderRadius: 16, borderWidth: 1, borderColor: "#29292f", padding: 18, gap: 12 },
  dialogTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700", flex: 1 },
  dialogHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberList: { maxHeight: 420 },
  memberCard: { backgroundColor: "#27272a", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, gap: 5 },
  memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  memberName: { flex: 1, minWidth: 0, color: "#fafafa", fontSize: 14, fontWeight: "600" },
  memberEmail: { color: "#a1a1aa", fontSize: 12 },
  memberBadge: { color: "#e9d5ff", backgroundColor: "#7e22ce33", borderRadius: 20, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "700" },
  pendingBadge: { color: "#fde68a", backgroundColor: "#b4530933", borderRadius: 20, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "700" },
  dialogInput: { minHeight: 46, color: "#fafafa", backgroundColor: "#27272a", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  primaryDialogButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#6b21a8", paddingHorizontal: 14 },
  primaryDialogText: { color: "#fff", fontWeight: "700" },
  dangerDialogButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#7f1d1d", borderWidth: 1, borderColor: "#ef44444d", paddingHorizontal: 14 },
  dangerDialogText: { color: "#fecaca", fontWeight: "700" },
  summary: { backgroundColor: "#18181b", borderColor: "#27272a", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4, gap: 0 },
  balanceCard: { backgroundColor: "#5b2580", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, gap: 4 },
  balanceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceLabel: { color: "#f3e8ff", fontSize: 13 },
  balanceValue: { color: "#fff", fontSize: 29, fontWeight: "700", letterSpacing: 0.2 },
  adjustmentText: { color: "#e9d5ff", fontSize: 10, marginTop: 3 },
  eyeButton: { height: 34, width: 34, alignItems: "center", justifyContent: "center" },
  eyeIcon: { position: "relative", height: 17, width: 25, alignItems: "center", justifyContent: "center" },
  eyeShape: { height: 13, width: 21, borderRadius: 11, borderWidth: 1.6, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  eyeSlash: { position: "absolute", width: 27, height: 1.5, borderRadius: 1, backgroundColor: "#fff", transform: [{ rotate: "-35deg" }] },
  eyePupil: { height: 5, width: 5, borderRadius: 3, backgroundColor: "#fff" },
  summaryItem: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 8, borderBottomColor: "#27272a", borderBottomWidth: 1 },
  summaryLabel: { flex: 1, color: "#d4d4d8", fontSize: 13 },
  summaryValue: { color: "#fafafa", fontSize: 13, fontWeight: "700" },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  creditDot: { backgroundColor: "#34d399" },
  fixedDot: { backgroundColor: "#a855f7" },
  variableDot: { backgroundColor: "#fbbf24" },
  accountDot: { width: 7, height: 7, borderRadius: 4 },
  section: { backgroundColor: "#18181b", borderColor: "#29292f", borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionTitle: { color: "#c084fc", fontSize: 16, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  addAccountButton: { backgroundColor: "#6b21a8", borderRadius: 20, height: 32, minWidth: 32, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  addAccountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  editButton: { backgroundColor: "#27272a", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9 },
  editButtonText: { color: "#d4d4d8", fontSize: 11, fontWeight: "600" },
  deleteButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  deleteButtonText: { color: "#fecaca", fontSize: 11, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  accountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  paidAccountRow: { backgroundColor: "#14532d22", borderColor: "#4ade8040", borderLeftWidth: 4, borderLeftColor: "#4ade80" },
  unpaidAccountRow: { backgroundColor: "#7f1d1d22", borderColor: "#f8717140", borderLeftWidth: 4, borderLeftColor: "#f87171" },
  accountNameWrap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  accountRowTrailing: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  accountName: { flex: 1, color: "#e4e4e7", fontSize: 14 },
  accountValue: { color: "#f87171", fontSize: 14, fontWeight: "600" },
  transactionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderTopColor: "#27272a", borderTopWidth: 1, paddingTop: 10 },
  transactionInfo: { flex: 1, gap: 4 },
  transactionTitle: { color: "#e4e4e7", fontSize: 14, fontWeight: "500" },
  transactionValue: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  agendaGroup: { backgroundColor: "#27272a", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 12, padding: 13, gap: 8 },
  agendaLabel: { color: "#d4d4d8", fontSize: 13 },
  creditValue: { color: "#86efac" },
  expenseValue: { color: "#fdba74" },
  error: { color: "#fca5a5", fontSize: 14 },
  reportWrap: { gap: 14 },
  reportHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reportTitle: { flex: 1, color: "#fafafa", fontSize: 20, fontWeight: "700" },
  reportYearNav: { flexDirection: "row", alignItems: "center", backgroundColor: "#18181b", borderRadius: 20, borderWidth: 1, borderColor: "#303036" },
  reportYearButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  reportYear: { color: "#fff", fontSize: 14, fontWeight: "700" },
  reportCards: { flexDirection: "row" },
  reportValueCard: { minHeight: 118, padding: 16, borderRadius: 14, backgroundColor: "#301b3d", gap: 8, justifyContent: "center" },
  reportValue: { color: "#fff", fontSize: 21, fontWeight: "700" },
  reportRow: { paddingVertical: 13, gap: 5, borderBottomColor: "#27272a", borderBottomWidth: 1 },
  reportMonthTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportMetric: { color: "#e4e4e7", fontSize: 13 },
  reportSubmetric: { color: "#a1a1aa", fontSize: 12 },
  reportTotalRow: { borderBottomWidth: 0, marginTop: 5, backgroundColor: "#18181b", borderRadius: 12, paddingHorizontal: 12 },
  reportListRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomColor: "#27272a", borderBottomWidth: 1 },
  dateEntry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: "#21182a", borderRadius: 9, marginTop: 3 },
  dateEntryMain: { flex: 1, gap: 3 },
  dateEntryText: { color: "#d8b4fe", fontSize: 12 },
  dateModalBackdrop: { flex: 1, backgroundColor: "#000a", alignItems: "center", justifyContent: "center", padding: 22 },
  dateModal: { width: "100%", backgroundColor: "#18181b", borderRadius: 18, borderWidth: 1, borderColor: "#3f3f46", padding: 18, gap: 12 },
  pixHistoryModal: { width: "100%", maxWidth: 420, maxHeight: "82%", backgroundColor: "#18181b", borderRadius: 18, borderWidth: 1, borderColor: "#3f3f46", padding: 16, gap: 14 },
  pixHistoryList: { flexGrow: 0, maxHeight: "70%" },
  pixHistoryRow: { borderBottomWidth: 1, borderBottomColor: "#27272a", paddingVertical: 10, gap: 6 },
  dateInput: { borderRadius: 10, borderWidth: 1, borderColor: "#3f3f46", backgroundColor: "#111114", color: "#fafafa", padding: 13 },
  dateModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  classifyingAccountList: { maxHeight: 260 },
  classifyingAccount: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#27272a" },
  classifyingAccountSelected: { backgroundColor: "#3b1d4c", borderRadius: 9 },
  cancelButton: { borderRadius: 10, backgroundColor: "#27272a", paddingVertical: 11, paddingHorizontal: 14 },
  cancelText: { color: "#e4e4e7", fontSize: 13, fontWeight: "600" },
  saveButton: { borderRadius: 10, backgroundColor: "#6b21a8", paddingVertical: 11, paddingHorizontal: 14 },
  saveText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
