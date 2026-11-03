import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getReactNativePersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { createFirebaseClient, type FirebasePublicConfig } from "@sistema-financas/firebase-shared";
import { ensureUserProfile } from "../../../src/services/userService";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
if (__DEV__ && hasFirebaseConfig && firebaseConfig.projectId !== "sistema-financas-dev") {
  throw new Error("O app mobile em desenvolvimento deve usar o projeto Firebase sistema-financas-dev.");
}
const firebase = hasFirebaseConfig
  ? createFirebaseClient(firebaseConfig as FirebasePublicConfig, getReactNativePersistence(AsyncStorage))
  : null;

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(firebase));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleGoogleLogin = async () => {
    setLoginError("");
    if (!firebase) return;

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      setLoginError("Falta configurar o Web Client ID do Google no app mobile.");
      return;
    }

    setIsSigningIn(true);
    try {
      GoogleSignin.configure({ webClientId });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) throw new Error("O Google não retornou um ID token.");

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(firebase.auth, credential);
    } catch (error) {
      console.error("Erro no login Google mobile:", error);
      setLoginError("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, async (nextUser) => {
      setUser(nextUser);
      setProfileError("");
      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
        } catch (error) {
          console.error("Não foi possível preparar o perfil financeiro:", error);
          setProfileError("Não foi possível preparar seus dados financeiros. Confira sua conexão e tente novamente.");
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    });
  }, []);

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controle Financeiro</Text>
      {user ? (
        <>
          <Text style={styles.body}>Conectado como {user.displayName || user.email}</Text>
          {profileError ? (
            <Text style={styles.error}>{profileError}</Text>
          ) : (
            <Text style={styles.caption}>Seu perfil e a configuração inicial foram carregados.</Text>
          )}
          <Text style={styles.caption}>A próxima etapa será trazer a tela inicial e os lançamentos.</Text>
          <Pressable style={styles.buttonSecondary} onPress={() => signOut(firebase!.auth)}>
            <Text style={styles.buttonText}>Sair</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>Entre com sua conta Google para acessar suas finanças.</Text>
          <Pressable
            style={[styles.button, isSigningIn && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={isSigningIn}
          >
            <Text style={styles.buttonText}>{isSigningIn ? "Abrindo Google…" : "Entrar com Google"}</Text>
          </Pressable>
          {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
        </>
      )}
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
