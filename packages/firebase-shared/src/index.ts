import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export const createFirebaseClient = (
  config: FirebasePublicConfig,
  persistence?: Persistence | Persistence[],
) => {
  const app = getApps().length ? getApp() : initializeApp(config);
  let auth: Auth;

  try {
    auth = initializeAuth(app, persistence ? { persistence } : undefined);
  } catch {
    auth = getAuth(app);
  }

  return { app, auth, db: getFirestore(app) };
};

export type { Auth, Persistence };
