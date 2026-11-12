import { useMemo, useRef, useState, type RefObject } from "react";
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatCurrencyInput, parseCurrencyInput } from "../../../shared/currencyInput";
import type { User } from "@firebase/auth";
import { isCreditCardAccount, isPixAccount, type FinanceAccount } from "../../../../../../src/domain/finance/account";
import type { FinanceCategory } from "../../../../../../src/domain/finance/category";

type LaunchInput = {
  accountId: string;
  value: number;
  date: string;
  category: string;
  note: string;
  installments: number;
  userId: string;
  userName: string;
};

type Props = {
  user: User | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: LaunchInput) => Promise<boolean>;
};

type DropdownKind = "account" | "category" | "installments";
type DropdownPosition = { kind: DropdownKind; top: number; left: number; width: number };

const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.getFullYear() === Number(match[1]) && parsed.getMonth() === Number(match[2]) - 1 && parsed.getDate() === Number(match[3]) ? parsed : new Date();
};
export default function MobileLaunchModal({ user, accounts, categories, busy, error, onClose, onSave }: Props) {
  const usableAccounts = useMemo(
    () => accounts.filter((account) => account.type === "VARIABLE" && account.isArchived !== true),
    [accounts],
  );
  const [accountId, setAccountId] = useState(() => {
    const primaryCard = usableAccounts.find((account) => account.isCreditCard && account.isPrimaryCreditCard);
    const anyCard = usableAccounts.find((account) => account.isCreditCard);
    return primaryCard?.id || anyCard?.id || usableAccounts[0]?.id || "";
  });
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [note, setNote] = useState("");
  const [installments, setInstallments] = useState("1");
  const [customInstallments, setCustomInstallments] = useState("");
  const [dropdown, setDropdown] = useState<DropdownPosition | null>(null);
  const accountAnchorRef = useRef<View>(null);
  const installmentAnchorRef = useRef<View>(null);
  const categoryAnchorRef = useRef<View>(null);
  const dialogRef = useRef<View>(null);
  const [formError, setFormError] = useState("");
  const selectedAccount = usableAccounts.find((account) => account.id === accountId);
  const isCard = isCreditCardAccount(selectedAccount);
  const isPix = isPixAccount(selectedAccount);
  const needsCategory = isCard || isPix;

  const openDropdown = (kind: DropdownKind, anchor: RefObject<View | null>) => {
    if (dropdown?.kind === kind) {
      setDropdown(null);
      return;
    }
    const { height: windowHeight, width: windowWidth } = Dimensions.get("window");
    const fallbackWidth = kind === "installments" ? windowWidth * 0.215 : windowWidth * 0.82;
    setDropdown({
      kind,
      top: kind === "installments" ? windowHeight * 0.438 : kind === "category" ? windowHeight * 0.52 : windowHeight * 0.35,
      left: kind === "installments" ? windowWidth * 0.697 : windowWidth * 0.09,
      width: fallbackWidth,
    });
    anchor.current?.measureInWindow((x, y, width, height) => {
      const left = Math.max(8, Math.min(x, windowWidth - (width || fallbackWidth) - 8));
      const estimatedHeight = kind === "installments" ? 220 : kind === "category" ? 190 : 220;
      const openAbove = kind === "category" || y + height + estimatedHeight + 8 > windowHeight;
      const fallbackTop = openAbove ? Math.max(8, y - estimatedHeight - 4) : y + height + 4;
      if (kind === "category") {
        dialogRef.current?.measureInWindow((_, dialogY) => {
          const top = Math.max(dialogY + 56, fallbackTop);
          setDropdown({ kind, top, left, width: width || fallbackWidth });
        });
      } else {
        setDropdown({ kind, top: fallbackTop, left, width: width || fallbackWidth });
      }
    });
  };

  const handleSave = async () => {
    setFormError("");
    const amount = parseCurrencyInput(value);
    const launchDate = date;
    if (!amount) return setFormError("Informe o valor do lançamento.");
    if (!accountId) return setFormError("Selecione uma conta.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) return setFormError("Informe uma data válida.");
    if (needsCategory && !category) return setFormError("Selecione uma categoria.");
    const installmentCount = isCard
      ? installments === "custom"
        ? Number(customInstallments || 0)
        : Number(installments || 0)
      : 1;
    if (isCard && (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 60)) {
      return setFormError("Informe entre 1 e 60 parcelas.");
    }
    if (!user) return setFormError("Sessão expirada. Entre novamente para continuar.");
    const saved = await onSave({
      accountId,
      value: amount,
      date: launchDate,
      category,
      note,
      installments: installmentCount,
      userId: user.uid,
      userName: user.displayName || user.email || "",
    });
    if (saved) onClose();
  };

  return (
    <>
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View ref={dialogRef} collapsable={false} style={styles.dialog}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Novo Lançamento</Text>

            <View>
              <Text style={styles.label}>Valor total</Text>
              <TextInput accessibilityLabel="Valor total" value={value} onChangeText={(text) => setValue(formatCurrencyInput(text))} placeholder="0,00" placeholderTextColor="#71717a" keyboardType="decimal-pad" style={styles.inputShell} />
            </View>

            <View style={styles.accountRow}>
              <View style={styles.accountField}>
                <Text style={styles.label}>Conta</Text>
                <View ref={accountAnchorRef} collapsable={false}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Selecionar conta" disabled={busy} onPress={() => { setAccountSearch(""); openDropdown("account", accountAnchorRef); }} style={styles.selectInput}>
                    <Text numberOfLines={1} style={styles.selectText}>{selectedAccount?.name || "Selecione a conta"}</Text>
                    <Text style={styles.selectChevron}>⌄</Text>
                  </Pressable>
                </View>
              </View>
              {isCard ? (
                <View style={styles.installmentField}>
                  <Text style={styles.label}>Parcelas</Text>
                  {installments === "custom" ? (
                    <TextInput value={customInstallments} onChangeText={(text) => setCustomInstallments(text.replace(/\D/g, ""))} onBlur={() => { if (!customInstallments) { setInstallments("1"); } }} placeholder="Qtd" placeholderTextColor="#71717a" keyboardType="number-pad" style={styles.inputShell} />
                  ) : (
                    <View ref={installmentAnchorRef} collapsable={false}>
                      <Pressable accessibilityRole="button" accessibilityLabel="Selecionar parcelas" disabled={busy} onPress={() => openDropdown("installments", installmentAnchorRef)} style={styles.selectInput}>
                        <Text style={styles.selectText}>{installments}x</Text>
                        <Text style={styles.selectChevron}>⌄</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
            </View>

            {needsCategory ? (
              <View>
                <Text style={styles.label}>Categoria</Text>
                <View ref={categoryAnchorRef} collapsable={false}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Selecionar categoria" disabled={busy} onPress={() => { setCategorySearch(""); openDropdown("category", categoryAnchorRef); }} style={styles.selectInput}>
                    <Text numberOfLines={1} style={[styles.selectText, !category && styles.placeholder]}>{category || "Selecione a categoria"}</Text>
                    <Text style={styles.selectChevron}>⌄</Text>
                  </Pressable>
                </View>
                {!categories.length ? <Text style={styles.empty}>Carregando categorias…</Text> : null}
              </View>
            ) : null}

            <View>
              <Text style={styles.label}>Observação</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="Observação" placeholderTextColor="#71717a" style={styles.inputShell} />
            </View>
            <View>
              <Text style={styles.label}>Data</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Selecionar data do lançamento" disabled={busy} onPress={() => { const selected = parseIsoDate(date); setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setShowDatePicker(true); }} style={[styles.inputShell, styles.dateButton]}>
                <Text style={styles.dateText}>{parseIsoDate(date).toLocaleDateString("pt-BR")}</Text>
                <Text style={styles.dateIcon}>▦</Text>
              </Pressable>
            </View>
            {formError || error ? <Text style={styles.error}>{formError || error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={[styles.saveButton, busy && styles.disabled]} onPress={() => void handleSave()} disabled={busy}>
              <Text style={styles.saveText}>{busy ? "Salvando…" : "Salvar"}</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={busy}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      {showDatePicker ? (
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarDialog}>
            <Text style={styles.title}>Data do lançamento</Text>
            <View style={styles.calendarHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthButton}><Text style={styles.monthArrow}>‹</Text></Pressable>
              <Text style={styles.calendarMonth}>{calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthButton}><Text style={styles.monthArrow}>›</Text></Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {["S", "T", "Q", "Q", "S", "S", "D"].map((weekday, index) => <Text key={`${weekday}-${index}`} style={styles.weekday}>{weekday}</Text>)}
              {Array.from({ length: (calendarMonth.getDay() + 6) % 7 }, (_, index) => <View key={`empty-${index}`} style={styles.calendarDay} />)}
              {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => {
                const day = index + 1;
                const selected = parseIsoDate(date).getDate() === day && parseIsoDate(date).getMonth() === calendarMonth.getMonth() && parseIsoDate(date).getFullYear() === calendarMonth.getFullYear();
                return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${day} de ${calendarMonth.toLocaleDateString("pt-BR", { month: "long" })}`} onPress={() => { setDate(toIsoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))); setShowDatePicker(false); }} style={[styles.calendarDay, selected && styles.calendarDaySelected]}><Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>{day}</Text></Pressable>;
              })}
            </View>
            <Pressable style={styles.calendarCancel} onPress={() => setShowDatePicker(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
    <Modal visible={dropdown !== null} transparent animationType="none" onRequestClose={() => setDropdown(null)} statusBarTranslucent>
      {dropdown ? (
        <View style={styles.dropdownLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDropdown(null)} />
          <View style={[styles.dropdownPanel, { top: dropdown.top, left: dropdown.left, width: dropdown.width }]}>
            {dropdown.kind === "account" ? (
              <>
                <TextInput value={accountSearch} onChangeText={setAccountSearch} placeholder="Buscar conta" placeholderTextColor="#71717a" style={styles.searchInput} />
                <ScrollView nestedScrollEnabled style={styles.optionsList} keyboardShouldPersistTaps="handled">
                  {usableAccounts.filter((account) => account.name.toLowerCase().includes(accountSearch.trim().toLowerCase())).map((account) => (
                    <Pressable key={account.id} onPress={() => { setAccountId(account.id); setCategory(""); setDropdown(null); }} style={styles.optionRow}>
                      <Text numberOfLines={1} style={[styles.optionText, account.id === accountId && styles.optionSelected]}>{account.name}</Text>
                    </Pressable>
                  ))}
                  {!usableAccounts.some((account) => account.name.toLowerCase().includes(accountSearch.trim().toLowerCase())) ? <Text style={styles.empty}>Nenhuma conta encontrada.</Text> : null}
                </ScrollView>
              </>
            ) : null}
            {dropdown.kind === "category" ? (
              <>
                <TextInput value={categorySearch} onChangeText={setCategorySearch} placeholder="Buscar categoria" placeholderTextColor="#71717a" style={styles.searchInput} />
                <ScrollView nestedScrollEnabled style={styles.optionsList} keyboardShouldPersistTaps="handled">
                  {categories.filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase())).map((item) => (
                    <Pressable key={item.id} onPress={() => { setCategory(item.name); setDropdown(null); }} style={styles.optionRow}>
                      <Text numberOfLines={1} style={[styles.optionText, category === item.name && styles.optionSelected]}>{item.name}</Text>
                    </Pressable>
                  ))}
                  {!categories.some((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase())) ? <Text style={styles.empty}>Nenhuma categoria encontrada.</Text> : null}
                </ScrollView>
              </>
            ) : null}
            {dropdown.kind === "installments" ? (
              <ScrollView nestedScrollEnabled style={styles.installmentList} keyboardShouldPersistTaps="handled">
                {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((item) => (
                  <Pressable key={item} onPress={() => { setInstallments(item); setCustomInstallments(""); setDropdown(null); }} style={styles.optionRow}>
                    <Text style={styles.optionText}>{item}x</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => { setInstallments("custom"); setDropdown(null); }} style={styles.optionRow}><Text style={styles.optionText}>Outro</Text></Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      ) : null}
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000b", paddingHorizontal: 16, paddingVertical: 24 },
  backdrop: { ...StyleSheet.absoluteFill },
  dialog: { width: "100%", maxWidth: 380, maxHeight: "90%", backgroundColor: "#18181b", borderRadius: 12, borderColor: "#27272a", borderWidth: 1, padding: 20 },
  title: { color: "#fafafa", fontSize: 18, fontWeight: "700", marginBottom: 2 },
  content: { paddingBottom: 2, gap: 12 },
  label: { color: "#a1a1aa", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  accountRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  accountField: { flex: 1, minWidth: 0 },
  installmentField: { width: 88 },
  selectInput: { minHeight: 42, borderRadius: 8, backgroundColor: "#27272a", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectText: { flex: 1, color: "#fafafa", fontSize: 14 },
  selectChevron: { color: "#a1a1aa", fontSize: 18 },
  placeholder: { color: "#71717a" },
  optionsPanel: { backgroundColor: "#202024", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 8, padding: 8, gap: 4, marginTop: 5 },
  searchInput: { minHeight: 38, borderRadius: 7, backgroundColor: "#18181b", color: "#fafafa", paddingHorizontal: 10, fontSize: 14 },
  optionsList: { maxHeight: 132 },
  optionRow: { minHeight: 38, justifyContent: "center", paddingHorizontal: 10, borderRadius: 6 },
  optionText: { color: "#e4e4e7", fontSize: 14 },
  optionSelected: { color: "#d8b4fe", fontWeight: "700" },
  inputShell: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: "#3f3f46", backgroundColor: "#1c1c20", color: "#fafafa", paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  dateButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { color: "#fafafa", fontSize: 14 },
  dateIcon: { color: "#a1a1aa", fontSize: 18 },
  calendarOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, justifyContent: "center", backgroundColor: "#000b", padding: 20 },
  calendarDialog: { backgroundColor: "#18181b", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#27272a", alignItems: "center", justifyContent: "center" },
  monthArrow: { color: "#fafafa", fontSize: 28, lineHeight: 32 },
  calendarMonth: { color: "#fafafa", fontSize: 16, fontWeight: "700", textTransform: "capitalize" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: "14.2857%", color: "#a1a1aa", fontSize: 12, fontWeight: "700", textAlign: "center", paddingVertical: 8 },
  calendarDay: { width: "14.2857%", height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  calendarDaySelected: { backgroundColor: "#7c3aed" },
  calendarDayText: { color: "#e4e4e7", fontSize: 14 },
  calendarDayTextSelected: { color: "#fff", fontWeight: "700" },
  calendarCancel: { alignSelf: "flex-end", backgroundColor: "#27272a", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  empty: { color: "#71717a", fontSize: 12 },
  error: { color: "#fca5a5", fontSize: 13, lineHeight: 19 },
  footer: { paddingTop: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cancelButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#27272a" },
  cancelText: { color: "#e4e4e7", fontSize: 13, fontWeight: "600" },
  saveButton: { minWidth: 100, minHeight: 46, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#9333ea" },
  saveText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  installmentList: { maxHeight: 220 },
  dropdownLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20 },
  dropdownPanel: { position: "absolute", maxHeight: 280, backgroundColor: "#202024", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 8, padding: 8, gap: 4, elevation: 24 },
});
