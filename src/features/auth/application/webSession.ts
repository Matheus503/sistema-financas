import type { User } from "firebase/auth";
import { webAuthRepository } from "../data/webAuthRepository";

export const observeWebUser = (onUser: (user: User | null) => void) =>
  webAuthRepository.subscribeToUser(onUser);

export const getCurrentWebUser = () => webAuthRepository.getCurrentUser();

export const signOutWebUser = () => webAuthRepository.signOut();
