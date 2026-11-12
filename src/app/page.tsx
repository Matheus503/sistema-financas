"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getLoginFirebaseConfig,
  signInWithGoogle,
  subscribeToLoginUser,
  validateLoginProfile,
} from "../features/auth/application/loginSession";

export default function LoginPage() {
  const router = useRouter();
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const handleLogin = async () => {
    setLoginError("");
    setIsLoggingIn(true);

    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "";

      const firebaseConfig = getLoginFirebaseConfig();
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
  let active = true;
  const unsub = subscribeToLoginUser(async (user) => {
    if (!user) {
      if (active) setIsCheckingSession(false);
      return;
    }

    const profileFailure = await validateLoginProfile(user);
    if (!active) return;
    if (profileFailure) {
      setLoginError(profileFailure.message);
      toast.error(profileFailure.message);
      console.error("Erro ao carregar perfil:", profileFailure.cause);
      setIsCheckingSession(false);
      return;
    }

    const currentPath = window.location.pathname;

    // 🔥 Se já está no mobile, NÃO redireciona
    if (currentPath.startsWith("/mobile")) {
      setIsCheckingSession(false);
      return;
    }

    // 🔥 Detecta mobile
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      router.replace("/mobile");
    } else {
      router.replace("/dashboard");
    }
  });

  return () => {
    active = false;
    unsub();
  };
}, [router]);

  if (isCheckingSession) {
    return <div className="min-h-screen bg-black" aria-busy="true" />;
  }

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
