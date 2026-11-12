import { db } from "../../../lib/firestore";
import {
  createUserProfileService,
  ExistingOwnerAccountError,
} from "./userProfileService";
import { ensurePersonalSpace } from "./personalSpaceService";

const profileService = createUserProfileService(db, {
  ensurePersonalSpace,
  applySpaceTheme: (space) => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = space;
  },
});

export const ensureWebUserProfile = profileService.ensureUserProfile;
export const ensureWebPersonalSpace = (user: Parameters<typeof ensurePersonalSpace>[0]) =>
  ensurePersonalSpace(user, db);
export { ExistingOwnerAccountError };
