import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { FinanceTransaction } from "../../../../../../src/domain/finance/transaction";
import { formatCurrencyAmount, formatCurrencyInput, parseCurrencyInput } from "../../../shared/currencyInput";

type Props = {
  transaction: FinanceTransaction | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (value: number) => Promise<boolean>;
};

export default function EditMobileTransactionModal({ transaction, busy, error, onClose, onSave }: Props) {
  const [value, setValue] = useState(() => formatCurrencyAmount(Number(transaction?.value || 0)));
  const [formError, setFormError] = useState("");
  const save = async () => {
    const amount = parseCurrencyInput(value);
    if (amount <= 0) return setFormError("Informe um valor maior que zero.");
    if (await onSave(amount)) onClose();
  };
  return (
    <Modal visible={Boolean(transaction)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Editar valor</Text>
          <TextInput accessibilityLabel="Valor" value={value} onChangeText={(text) => setValue(formatCurrencyInput(text))} keyboardType="decimal-pad" style={styles.input} />
          {formError || error ? <Text style={styles.error}>{formError || error}</Text> : null}
          <View style={styles.actions}>
            <Pressable disabled={busy} onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>{busy ? "Salvando…" : "Salvar"}</Text></Pressable>
            <Pressable disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000b", padding: 16 },
  sheet: { width: "100%", maxWidth: 380, backgroundColor: "#18181b", borderRadius: 16, padding: 20, gap: 12, borderColor: "#27272a", borderWidth: 1 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#3f3f46", backgroundColor: "#27272a", color: "#fff", fontSize: 16, paddingHorizontal: 12 },
  error: { color: "#fca5a5", fontSize: 13 },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 },
  cancel: { backgroundColor: "#3f3f46", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15 },
  cancelText: { color: "#e4e4e7", fontWeight: "600" },
  save: { backgroundColor: "#9333ea", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  saveText: { color: "#fff", fontWeight: "700" },
});
