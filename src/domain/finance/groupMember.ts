export type UserRole = "admin" | "member";

export type GroupMemberListItem = {
  id: string;
  name: string;
  email: string;
  groupId: string;
  status: "active" | "pending";
  role: UserRole;
};
