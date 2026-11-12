import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from "@firebase/auth";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { firebase, mobileUserProfileService } from "../../../platform/firebaseClient";
import { createMobileSessionService } from "../application/mobileSession";

function createConfiguredMobileSessionClient() {
  if (!firebase || !mobileUserProfileService) return null;
  const client = firebase;
  const profileService = mobileUserProfileService;

  return createMobileSessionService({
      async loginWithGoogle() {
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (!webClientId) throw new Error("Falta configurar o Web Client ID do Google no app mobile.");

        GoogleSignin.configure({ webClientId });
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return;

        const idToken = response.data.idToken;
        if (!idToken) throw new Error("O Google não retornou um ID token.");
        await signInWithCredential(client.auth, GoogleAuthProvider.credential(idToken));
      },
      signOut: () => signOut(client.auth),
      subscribeToUser: (onUser) => onAuthStateChanged(client.auth, onUser),
      ensureUserProfile: (user) => profileService.ensureUserProfile(user),
    });
}

export const mobileSessionClient = createConfiguredMobileSessionClient();
