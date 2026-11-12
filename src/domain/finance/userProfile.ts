import type { UserRole } from "./groupMember";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  groupId: string;
  role: UserRole;
  createdAt?: unknown;
  lastLogin?: unknown;
  personalGroupId?: string;
  activeSpace?: "family" | "personal";
};
