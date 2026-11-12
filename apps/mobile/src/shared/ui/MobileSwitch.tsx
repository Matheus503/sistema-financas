import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
};

export default function MobileSwitch({ label, value, disabled = false, onValueChange }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    backgroundColor: "rgba(39,39,42,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: { backgroundColor: "#27272a" },
  disabled: { opacity: 0.6 },
  label: { color: "#e4e4e7", fontSize: 13, fontWeight: "600" },
  track: {
    width: 44,
    height: 24,
    justifyContent: "center",
    borderRadius: 12,
    padding: 4,
  },
  trackOn: { backgroundColor: "#7c3aed" },
  trackOff: { backgroundColor: "#3f3f46" },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fafafa" },
  thumbOn: { alignSelf: "flex-end" },
  thumbOff: { alignSelf: "flex-start" },
});
