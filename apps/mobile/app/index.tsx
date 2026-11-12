import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { hasFirebaseConfig } from "../src/platform/firebaseClient";
import { useMobileSession } from "../src/features/auth/hooks/useMobileSession";
import MobileDashboardScreen from "../src/features/dashboard/ui/MobileDashboardScreen";

export default function HomeScreen() {
  const {
    user,
    profile,
    loading,
    isSigningIn,
    profileError,
    loginError,
    handleGoogleLogin,
    handleSignOut,
  } = useMobileSession();

  if (!hasFirebaseConfig) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Controle Financeiro</Text>
        <Text style={styles.body}>Configure as variáveis EXPO_PUBLIC_FIREBASE_* para conectar ao Firebase de desenvolvimento.</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.container}><ActivityIndicator color="#a855f7" size="large" /></View>;
  }

  if (user) {
    if (profileError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Controle Financeiro</Text>
          <Text style={styles.error}>{profileError}</Text>
          <Pressable style={styles.buttonSecondary} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sair</Text>
          </Pressable>
        </View>
      );
    }
    if (profile) {
      return <MobileDashboardScreen key={profile.groupId} groupId={profile.groupId} activeSpace={profile.activeSpace === "personal" ? "personal" : "family"} user={user} onSignOut={handleSignOut} />;
    }
    return <View style={styles.container}><ActivityIndicator color="#a855f7" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controle Financeiro</Text>
      <Text style={styles.body}>Entre com sua conta Google para acessar suas finanças.</Text>
      <Pressable
        style={[styles.button, isSigningIn && styles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={isSigningIn}
      >
        <Text style={styles.buttonText}>{isSigningIn ? "Abrindo Google…" : "Entrar com Google"}</Text>
      </Pressable>
      {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", alignItems: "center", justifyContent: "center", padding: 28 },
  title: { color: "#fafafa", fontSize: 26, fontWeight: "700", marginBottom: 14, textAlign: "center" },
  body: { color: "#d4d4d8", fontSize: 16, textAlign: "center", lineHeight: 24 },
  caption: { color: "#a1a1aa", fontSize: 14, textAlign: "center", marginTop: 14, lineHeight: 21 },
  error: { color: "#fca5a5", fontSize: 14, textAlign: "center", marginTop: 14, lineHeight: 21 },
  button: { marginTop: 28, backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 15, paddingHorizontal: 24, minWidth: 220, alignItems: "center" },
  buttonDisabled: { opacity: 0.65 },
  buttonSecondary: { marginTop: 24, backgroundColor: "#27272a", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 22 },
  buttonText: { color: "#fafafa", fontWeight: "600", fontSize: 16 },
});
