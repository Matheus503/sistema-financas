import { getAuth } from "firebase/auth";
import { app, firebaseConfig } from "../../../lib/firebase";
import { createAuthRepository } from "./authRepository";
import { createGoogleSignIn } from "./googleSignIn";
import {
  ensureWebUserProfile,
  ExistingOwnerAccountError,
} from "./webUserProfileRepository";

const auth = getAuth(app);

export const webAuthRepository = createAuthRepository({
  auth,
  signInWithGoogle: createGoogleSignIn(auth),
  ensureUserProfile: ensureWebUserProfile,
  firebaseConfig: {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  },
  isExistingOwnerAccountError: (error): error is ExistingOwnerAccountError =>
    error instanceof ExistingOwnerAccountError,
});
