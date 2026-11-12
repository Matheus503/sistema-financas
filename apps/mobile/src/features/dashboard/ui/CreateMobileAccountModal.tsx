import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MobileAccountCreationInput, MobileAccountType } from "../application/mobileDashboard";
import { formatCurrencyInput, parseCurrencyInput } from "../../../shared/currencyInput";
import MobileSwitch from "../../../shared/ui/MobileSwitch";

type Props = {
  visible: boolean;
  type: MobileAccountType | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (input: MobileAccountCreationInput) => Promise<boolean>;
};

const typeLabels: Record<MobileAccountType, string> = {
  CREDIT: "Crédito",
  FIXED: "Fixa",
  VARIABLE: "Variável",
};

export default function CreateMobileAccountModal({ visible, type, busy, error, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [isCreditCard, setIsCreditCard] = useState(false);

  async function submit() {
    if (!type) return;
    const parsedValue = parseCurrencyInput(value);
    const created = await onCreate({
      name,
      type,
      value: parsedValue,
      dueDay: dueDay ? Number(dueDay) : undefined,
      closingDay: isCreditCard && closingDay ? Number(closingDay) : undefined,
      isCreditCard,
    });
    if (created) {
      setName("");
      setValue("");
      setDueDay("");
      setClosingDay("");
      setIsCreditCard(false);
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.dialogWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Text style={styles.title}>Nova conta</Text>
            {type ? <Text style={styles.subtitle}>Tipo: {typeLabels[type]}</Text> : null}

            <Text style={styles.label}>Nome da conta</Text>
            <TextInput
              accessibilityLabel="Nome da conta"
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Salário ou aluguel"
              placeholderTextColor="#71717a"
              style={styles.input}
              editable={!busy}
              returnKeyType="next"
            />

            {type === "VARIABLE" ? (
              <MobileSwitch label="Cartão de crédito" value={isCreditCard} onValueChange={(enabled) => {
                  setIsCreditCard(enabled);
                  if (!enabled) setClosingDay("");
                }} disabled={busy} />
            ) : null}

            {!isCreditCard ? (
              <>
                <Text style={styles.label}>Valor inicial</Text>
                <TextInput
                  accessibilityLabel="Valor inicial"
                  value={value}
                  onChangeText={(next) => setValue(formatCurrencyInput(next))}
                  placeholder="0,00"
                  placeholderTextColor="#71717a"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  editable={!busy}
                />
              </>
            ) : null}

            {isCreditCard ? (
              <>
                <Text style={styles.label}>Dia de fechamento</Text>
                <TextInput
                  accessibilityLabel="Dia de fechamento"
                  value={closingDay}
                  onChangeText={(next) => setClosingDay(next.replace(/\D/g, "").slice(0, 2))}
                  placeholder="1 a 31"
                  placeholderTextColor="#71717a"
                  keyboardType="number-pad"
                  style={styles.input}
                  editable={!busy}
                  maxLength={2}
                />
              </>
            ) : null}

            <Text style={styles.label}>Dia de vencimento</Text>
            <TextInput
              accessibilityLabel="Dia de vencimento"
              value={dueDay}
              onChangeText={(next) => setDueDay(next.replace(/\D/g, "").slice(0, 2))}
              placeholder="Opcional, de 1 a 31"
              placeholderTextColor="#71717a"
              keyboardType="number-pad"
              style={styles.input}
              editable={!busy}
              maxLength={2}
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} disabled={busy} onPress={onClose}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void submit()}>
                <Text style={styles.buttonText}>{busy ? "Salvando…" : "Criar conta"}</Text>
              </Pressable>
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
