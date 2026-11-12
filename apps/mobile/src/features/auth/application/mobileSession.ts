import type { User } from "@firebase/auth";
import type { UserProfile } from "../../../../../../src/domain/finance/userProfile";

export type MobileSessionDependencies = {
  loginWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  subscribeToUser(onUser: (user: User | null) => void): () => void;
  ensureUserProfile(user: User): Promise<UserProfile>;
};

export type MobileSessionState = {
  user: User | null;
  profile: UserProfile | null;
  profileError: string;
  loading: boolean;
};

export function createMobileSessionService(dependencies: MobileSessionDependencies) {
  return {
    login: dependencies.loginWithGoogle,
    signOut: dependencies.signOut,
    subscribe(onState: (state: MobileSessionState) => void) {
      return dependencies.subscribeToUser(async (user) => {
        onState({ user, profile: null, profileError: "", loading: true });
        if (!user) {
          onState({ user: null, profile: null, profileError: "", loading: false });
          return;
        }

        try {
          const profile = await dependencies.ensureUserProfile(user);
          onState({ user, profile, profileError: "", loading: false });
        } catch (error) {
          console.error("Não foi possível preparar o perfil financeiro:", error);
          onState({
            user,
            profile: null,
            profileError: "Não foi possível preparar seus dados financeiros. Confira sua conexão e tente novamente.",
            loading: false,
          });
        }
      });
    },
  };
}
