import type { User } from "firebase/auth";
import type { UserProfile } from "../../../domain/finance/userProfile";
import type { UserRole } from "../../../domain/finance/groupMember";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

export type { UserProfile } from "../../../domain/finance/userProfile";

export class ExistingOwnerAccountError extends Error {
  constructor() {
    super("Este usuario ja possui uma conta cadastrada e nao pode entrar como membro de outro grupo.");
    this.name = "ExistingOwnerAccountError";
  }
}

type UserProfileServiceDependencies = {
  ensurePersonalSpace: (user: User, firestore: Firestore) => Promise<string>;
  applySpaceTheme?: (space: "family" | "personal") => void;
};

const getUserName = (user: User) =>
  user.displayName || user.email?.split("@")[0] || "Usuario";
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function createUserProfileService(
  db: Firestore,
  dependencies: UserProfileServiceDependencies,
) {
  let pendingProfile: { uid: string; promise: Promise<UserProfile> } | null = null;

  const getAssignedGroupId = async (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return "";
    const assignment = await getDoc(doc(db, "groupAssignments", normalizedEmail));
    if (!assignment.exists()) return "";
    const groupId = assignment.data().groupId;
    return typeof groupId === "string" ? groupId : "";
  };

  const getGroupOwnerUid = async (groupId: string) => {
    if (!groupId) return "";
    const group = await getDoc(doc(db, "groups", groupId));
    if (!group.exists()) return "";
    const ownerUid = group.data().ownerUid;
    return typeof ownerUid === "string" ? ownerUid : "";
  };

  const getUserRole = async (uid: string, groupId: string): Promise<UserRole> => {
    const ownerUid = await getGroupOwnerUid(groupId);
    return ownerUid && ownerUid === uid ? "admin" : "member";
  };

  const upsertRegisteredEmail = async (profile: UserProfile) => {
    if (!profile.email) return;
    try {
      await setDoc(doc(db, "registeredEmails", normalizeEmail(profile.email)), {
        uid: profile.uid,
        email: normalizeEmail(profile.email),
        groupId: profile.groupId,
        role: profile.role,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // O indice de e-mail e auxiliar; falhas nele nao devem bloquear o login.
    }
  };

  const ensureUserProfileRemote = async (user: User, email: string) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const assignedGroupId = await getAssignedGroupId(email);

    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      const currentRole = await getUserRole(user.uid, profile.groupId);

      if (assignedGroupId && assignedGroupId !== profile.groupId && currentRole === "admin") {
        await upsertRegisteredEmail({ ...profile, name: getUserName(user), email, role: currentRole });
        throw new ExistingOwnerAccountError();
      }

      const groupId = assignedGroupId || profile.groupId;
      const role = assignedGroupId && assignedGroupId !== profile.groupId
        ? "member"
        : await getUserRole(user.uid, groupId);
      await updateDoc(userRef, {
        name: getUserName(user), email, groupId, role, lastLogin: serverTimestamp(),
      });
      const nextProfile = { ...profile, name: getUserName(user), email, groupId, role };
      await upsertRegisteredEmail(nextProfile);
      return nextProfile;
    }

    const now = serverTimestamp();
    const name = getUserName(user);
    let groupId = assignedGroupId;
    if (!groupId) {
      const groupRef = doc(collection(db, "groups"));
      groupId = groupRef.id;
      await setDoc(groupRef, { name: `Familia ${name}`, ownerUid: user.uid, createdAt: now, updatedAt: now });
    }
    const profile: UserProfile = {
      uid: user.uid, name, email, groupId, role: assignedGroupId ? "member" : "admin",
    };
    await setDoc(userRef, { ...profile, createdAt: now, lastLogin: now });
    await upsertRegisteredEmail(profile);
    return profile;
  };

  const ensureUserProfile = async (user: User) => {
    let promise = pendingProfile?.uid === user.uid ? pendingProfile.promise : null;
    if (!promise) {
      const email = normalizeEmail(user.email || "");
      promise = (async () => {
        const profile = await ensureUserProfileRemote(user, email);
        if (profile.activeSpace !== "personal") {
          dependencies.applySpaceTheme?.("family");
          return profile;
        }
        const personalGroupId = await dependencies.ensurePersonalSpace(user, db);
        dependencies.applySpaceTheme?.("personal");
        return { ...profile, groupId: personalGroupId, role: "admin" as const };
      })();
      pendingProfile = { uid: user.uid, promise };
    }

    try {
      return await promise;
    } finally {
      if (pendingProfile?.promise === promise) pendingProfile = null;
    }
  };

  return { ensureUserProfile };
}
