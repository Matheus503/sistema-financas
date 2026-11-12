import type { User } from "firebase/auth";
import {
  deleteCurrentUserAccount,
  setActiveSpace,
} from "../../members/data/userService";
import type { UserProfile } from "../../../domain/finance/userProfile";
import { db } from "../../../lib/firestore";
import {
  ensureWebUserProfile as ensureUserProfile,
  ensureWebPersonalSpace as ensurePersonalSpace,
  ExistingOwnerAccountError,
} from "../../auth/data/webUserProfileRepository";

export const dashboardProfileRepository = {
  ensureUserProfile,
  ensurePersonalSpace,
  setActiveSpace: (user: User, space: "family" | "personal") => setActiveSpace(user, space, db),
  deleteCurrentUserAccount: (profile: UserProfile) => deleteCurrentUserAccount(profile, db),
};

export { ExistingOwnerAccountError };
export type { User, UserProfile };
