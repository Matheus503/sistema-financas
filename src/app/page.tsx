"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginWithGoogle, auth } from "../lib/auth";
import { firebaseConfig } from "../lib/firebase";
import {
  ensureUserProfile,
  ExistingOwnerAccountError,
} from "../services/userService";

export default function LoginPage() {
  const router = useRouter();
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoginError("");
    setIsLoggingIn(true);

    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "";

      const message =
        code === "auth/unauthorized-domain"
          ? `Este endereço local não está autorizado no Firebase do projeto ${firebaseConfig.projectId}. Confira os domínios autorizados do authDomain ${firebaseConfig.authDomain}.`
          : code === "auth/popup-blocked"
            ? "O navegador bloqueou a janela de login do Google. Vou tentar redirecionar para o login."
            : "Não foi possível abrir o login do Google. Tente novamente.";

      setLoginError(message);
      toast.error(message);
      console.error("Erro ao fazer login:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

useEffect(() => {
  const unsub = auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
      await ensureUserProfile(user);
    } catch (error) {
      if (error instanceof ExistingOwnerAccountError) {
        const message = error.message;
        setLoginError(message);
        toast.error(message);
        await auth.signOut();
        return;
      }

      const message = "Nao foi possivel carregar seu perfil. Tente entrar novamente.";
      setLoginError(message);
      toast.error(message);
      console.error("Erro ao carregar perfil:", error);
      await auth.signOut();
      return;
    }

    const currentPath = window.location.pathname;

    // 🔥 Se já está no mobile, NÃO redireciona
    if (currentPath.startsWith("/mobile")) return;

    // 🔥 Detecta mobile
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      router.push("/mobile");
    } else {
      router.push("/dashboard");
    }
  });

  return () => unsub();
}, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-zinc-900 flex items-center justify-center text-white">

      <div className="bg-zinc-900/80 backdrop-blur p-8 rounded-2xl w-80 shadow-xl border border-zinc-800">

        <h1 className="text-2xl font-bold text-center mb-6">
          Controle Financeiro
        </h1>

        <p className="text-sm text-zinc-400 text-center mb-6">
          Entre com sua conta Google para continuar
        </p>

        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full bg-purple-600 hover:bg-purple-700 transition px-4 py-2 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? "Abrindo Google..." : "Entrar com Google"}
        </button>

        {loginError && (
          <p className="mt-4 text-sm text-red-300 text-center">
            {loginError}
          </p>
        )}

      </div>

    </div>
  );
}
