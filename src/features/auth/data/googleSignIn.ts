import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type User,
} from "firebase/auth";

export function createGoogleSignIn(auth: Auth) {
  const provider = new GoogleAuthProvider();

  return async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: unknown) {
      const code = error instanceof Error && "code" in error
        ? String(error.code)
        : "";

      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw error;
    }
  };
}
