import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { FinanceAccount } from "../../../../../../src/domain/finance/account";
import { getAccountClosingDay, getCreditCardClosingDay, isCreditCardAccount, isInstallmentAccount, isPixAccount } from "../../../../../../src/domain/finance/account";
import type { MobileCommonAccountUpdate } from "../application/mobileDashboard";
import { formatCurrencyAmount, formatCurrencyInput, parseCurrencyInput } from "../../../shared/currencyInput";
import MobileSwitch from "../../../shared/ui/MobileSwitch";

type Props = {
  account: FinanceAccount;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: MobileCommonAccountUpdate) => Promise<boolean>;
};

export default function EditMobileAccountModal({ account, busy, error, onClose, onSave }: Props) {
  const [name, setName] = useState(account.name);
  const [value, setValue] = useState(() => formatCurrencyAmount(Number(account.value || 0)));
  const [dueDay, setDueDay] = useState(account.dia_vencimento ? String(account.dia_vencimento) : "");
  const [closingDay, setClosingDay] = useState(account.dia_fechamento ? String(account.dia_fechamento) : isCreditCardAccount(account) ? String(getCreditCardClosingDay(account)) : isPixAccount(account) ? String(getAccountClosingDay(account)) : "");
  const [isArchived, setIsArchived] = useState(account.isArchived === true);
  const [isPrimaryCreditCard, setIsPrimaryCreditCard] = useState(account.isPrimaryCreditCard === true);
  const isCard = isCreditCardAccount(account);
  const isPix = isPixAccount(account);
  const isInstallment = isInstallmentAccount(account);

  async function submit() {
    await onSave({
      name,
      ...(!isCard ? { value: parseCurrencyInput(value) } : {}),
      dueDay: dueDay ? Number(dueDay) : undefined,
      closingDay: closingDay ? Number(closingDay) : undefined,
      ...(isCard ? { isArchived, isPrimaryCreditCard } : {}),
    });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.dialogWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Text style={styles.title}>Editar conta</Text>
            <Text style={styles.subtitle}>{account.type === "CREDIT" ? "Crédito" : account.type === "FIXED" ? "Conta fixa" : "Conta variável"}</Text>
            <Text style={styles.label}>Nome da conta</Text>
            <TextInput accessibilityLabel="Nome da conta" value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#71717a" editable={!busy} />
            {!isCard ? <><Text style={styles.label}>Valor inicial</Text><TextInput accessibilityLabel="Valor inicial" value={value} onChangeText={(next) => setValue(formatCurrencyInput(next))} style={styles.input} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#71717a" editable={!busy} /></> : null}
            {isCard || isPix ? <><Text style={styles.label}>Dia de fechamento</Text><TextInput accessibilityLabel="Dia de fechamento" value={closingDay} onChangeText={(next) => setClosingDay(next.replace(/\D/g, "").slice(0, 2))} style={styles.input} keyboardType="number-pad" placeholder="1 a 31" placeholderTextColor="#71717a" editable={!busy} maxLength={2} /></> : null}
            <Text style={styles.label}>Dia de vencimento</Text>
            <TextInput accessibilityLabel="Dia de vencimento" value={dueDay} onChangeText={(next) => setDueDay(next.replace(/\D/g, "").slice(0, 2))} style={styles.input} keyboardType="number-pad" placeholder="Opcional, de 1 a 31" placeholderTextColor="#71717a" editable={!busy} maxLength={2} />
            {isCard && !isInstallment ? <>
              <MobileSwitch label="Cartão arquivado" value={isArchived} onValueChange={setIsArchived} disabled={busy} />
              <MobileSwitch label="Cartão principal" value={isPrimaryCreditCard} onValueChange={setIsPrimaryCreditCard} disabled={busy} />
            </> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} disabled={busy} onPress={onClose}><Text style={styles.buttonText}>Cancelar</Text></Pressable>
              <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void submit()}><Text style={styles.buttonText}>{busy ? "Salvando…" : "Salvar"}</Text></Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center" },
  dialogWrap: { flexGrow: 1, justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: "#18181b", borderColor: "#3f3f46", borderWidth: 1, borderRadius: 18, padding: 20, gap: 10 },
  title: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#a1a1aa", fontSize: 13, marginBottom: 4 },
  label: { color: "#d4d4d8", fontSize: 13, fontWeight: "600" },
  input: { color: "#fafafa", backgroundColor: "#27272a", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  error: { color: "#fca5a5", fontSize: 13 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  secondaryButton: { backgroundColor: "#3f3f46", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  primaryButton: { backgroundColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  buttonText: { color: "#fafafa", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
