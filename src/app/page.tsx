"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithGoogle, auth } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();

useEffect(() => {
  const unsub = auth.onAuthStateChanged((user) => {
    if (!user) return;

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
          onClick={loginWithGoogle}
          className="w-full bg-purple-600 hover:bg-purple-700 transition px-4 py-2 rounded-xl font-semibold"
        >
          Entrar com Google
        </button>

      </div>

    </div>
  );
}