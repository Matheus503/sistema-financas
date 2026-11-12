import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence } from "@firebase/auth";
import { createFirebaseClient, type FirebasePublicConfig } from "@sistema-financas/firebase-shared";
import { createUserProfileService } from "../../../../src/features/auth/data/userProfileService";
import { createMobileDashboardRepository } from "../features/dashboard/data/mobileDashboardRepository";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

if (__DEV__ && hasFirebaseConfig && firebaseConfig.projectId !== "sistema-financas-dev") {
  throw new Error(
    "O app mobile em desenvolvimento deve usar o projeto Firebase sistema-financas-dev.",
  );
}

export const firebase = hasFirebaseConfig
  ? createFirebaseClient(
      firebaseConfig as FirebasePublicConfig,
      getReactNativePersistence(AsyncStorage),
    )
  : null;

export const mobileUserProfileService = firebase
  ? createUserProfileService(firebase.db, {
      ensurePersonalSpace: async (user, firestore) => {
        const { ensurePersonalSpace } = await import("../../../../src/features/auth/data/personalSpaceService");
        return ensurePersonalSpace(user, firestore);
      },
    })
  : null;

export const mobileDashboardRepository = firebase
  ? createMobileDashboardRepository(firebase.db)
  : null;
