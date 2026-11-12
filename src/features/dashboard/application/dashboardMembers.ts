import { dashboardMembersRepository, type GroupMemberListItem } from "../data/dashboardMembersRepository";

export function loadDashboardMembers(groupId: string) {
  return dashboardMembersRepository.getGroupMembers(groupId);
}

export async function inviteDashboardMember(
  name: string,
  email: string,
  groupId: string,
  createdByUid: string,
) {
  await dashboardMembersRepository.createGroupAssignment(name, email, groupId, createdByUid);
  return dashboardMembersRepository.getGroupMembers(groupId);
}

export async function removeDashboardMember(member: GroupMemberListItem, groupId: string) {
  await dashboardMembersRepository.deleteGroupMember(member);
  return dashboardMembersRepository.getGroupMembers(groupId);
}
