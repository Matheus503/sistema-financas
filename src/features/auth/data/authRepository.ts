import {
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

type FirebaseLoginConfig = {
  projectId: string;
  authDomain: string;
};

type AuthRepositoryDependencies = {
  auth: Auth;
  signInWithGoogle: () => Promise<User | null>;
  ensureUserProfile: (user: User) => Promise<unknown>;
  firebaseConfig: FirebaseLoginConfig;
  isExistingOwnerAccountError: (error: unknown) => error is Error;
};

export function createAuthRepository({
  auth,
  signInWithGoogle,
  ensureUserProfile,
  firebaseConfig,
  isExistingOwnerAccountError,
}: AuthRepositoryDependencies) {
  return {
    signInWithGoogle,
    subscribeToUser: (onUser: (user: User | null) => void) =>
      onAuthStateChanged(auth, onUser),
    getCurrentUser: () => auth.currentUser,
    ensureUserProfile,
    signOut: () => signOut(auth),
    getFirebaseConfig: () => firebaseConfig,
    isExistingOwnerAccountError,
  };
}
