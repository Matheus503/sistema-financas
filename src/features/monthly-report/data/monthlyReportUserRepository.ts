import type { User } from "firebase/auth";
import { ensureWebUserProfile } from "../../auth/data/webUserProfileRepository";

export async function getMonthlyReportGroupForUser(user: User) {
  const profile = await ensureWebUserProfile(user);
  return profile.groupId;
}
