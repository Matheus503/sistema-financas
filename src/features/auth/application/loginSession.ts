import type { User } from "firebase/auth";
import { webAuthRepository } from "../data/webAuthRepository";

export type LoginProfileFailure = {
  message: string;
  cause: unknown;
};

export const signInWithGoogle = () => webAuthRepository.signInWithGoogle();
export const subscribeToLoginUser = (onUser: (user: User | null) => void) =>
  webAuthRepository.subscribeToUser(onUser);
export const getLoginFirebaseConfig = () => webAuthRepository.getFirebaseConfig();

export async function validateLoginProfile(
  user: User,
): Promise<LoginProfileFailure | null> {
  try {
    await webAuthRepository.ensureUserProfile(user);
    return null;
  } catch (cause) {
    const message = webAuthRepository.isExistingOwnerAccountError(cause)
      ? cause.message
      : "Nao foi possivel carregar seu perfil. Tente entrar novamente.";
    await webAuthRepository.signOut();
    return { message, cause };
  }
}
