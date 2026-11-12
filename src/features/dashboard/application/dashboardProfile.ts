import {
  dashboardProfileRepository,
  ExistingOwnerAccountError,
  type User,
  type UserProfile,
} from "../data/dashboardProfileRepository";

export { ExistingOwnerAccountError };
export type { UserProfile };

export function loadDashboardProfile(user: User) {
  return dashboardProfileRepository.ensureUserProfile(user);
}

export async function deleteDashboardUserAccount(user: User) {
  const profile = await loadDashboardProfile(user);
  await dashboardProfileRepository.deleteCurrentUserAccount(profile);
  return profile;
}

export async function switchDashboardSpace(user: User, nextSpace: "family" | "personal") {
  if (nextSpace === "personal") {
    await dashboardProfileRepository.ensurePersonalSpace(user);
  }
  await dashboardProfileRepository.setActiveSpace(user, nextSpace);
}
