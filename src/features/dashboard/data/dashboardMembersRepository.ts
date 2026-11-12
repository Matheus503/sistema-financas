import {
  createGroupAssignment,
  deleteGroupMember,
  getGroupMembers,
} from "../../members/data/userService";
import type { GroupMemberListItem } from "../../../domain/finance/groupMember";
import { db } from "../../../lib/firestore";

export const dashboardMembersRepository = {
  getGroupMembers: (groupId: string) => getGroupMembers(groupId, db),
  createGroupAssignment: (name: string, email: string, groupId: string, uid: string) =>
    createGroupAssignment(name, email, groupId, uid, db),
  deleteGroupMember: (member: GroupMemberListItem) => deleteGroupMember(member, db),
};

export type { GroupMemberListItem };
