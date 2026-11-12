import { useEffect, useState } from "react";
import type { User } from "@firebase/auth";
import type { UserProfile } from "../../../../../../src/domain/finance/userProfile";
import { mobileSessionClient } from "../data/mobileSessionClient";

export function useMobileSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(mobileSessionClient));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loginError, setLoginError] = useState("");

  const handleGoogleLogin = async () => {
    setLoginError("");
    if (!mobileSessionClient) return;

    setIsSigningIn(true);
    try {
      await mobileSessionClient.login();
    } catch (error) {
      console.error("Erro no login Google mobile:", error);
      setLoginError("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = () => mobileSessionClient?.signOut() ?? Promise.resolve();

  useEffect(() => {
    if (!mobileSessionClient) return;
    return mobileSessionClient.subscribe((session) => {
      setUser(session.user);
      setProfile(session.profile);
      setProfileError(session.profileError);
      setLoading(session.loading);
    });
  }, []);

  return {
    user,
    profile,
    loading,
    isSigningIn,
    profileError,
    loginError,
    handleGoogleLogin,
    handleSignOut,
  };
}
