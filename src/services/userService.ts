import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../lib/firestore";

export type UserRole = "admin" | "member";

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  groupId: string;
  role: UserRole;
  createdAt?: unknown;
  lastLogin?: unknown;
};

export type GroupMemberListItem = {
  id: string;
  name: string;
  email: string;
  groupId: string;
  status: "active" | "pending";
  role: UserRole;
};

export class ExistingOwnerAccountError extends Error {
  constructor() {
    super(
      "Este usuario ja possui uma conta cadastrada e nao pode entrar como membro de outro grupo."
    );
    this.name = "ExistingOwnerAccountError";
  }
}

export class RegisteredEmailAlreadyExistsError extends Error {
  constructor() {
    super("Usuario ja cadastrado.");
    this.name = "RegisteredEmailAlreadyExistsError";
  }
}

const getUserName = (user: User) =>
  user.displayName || user.email?.split("@")[0] || "Usuario";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

let pendingProfile:
  | {
      uid: string;
      promise: Promise<UserProfile>;
    }
  | null = null;

const getAssignedGroupId = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return "";

  const assignmentSnap = await getDoc(
    doc(db, "groupAssignments", normalizedEmail)
  );

  if (!assignmentSnap.exists()) return "";

  const assignment = assignmentSnap.data();
  return typeof assignment.groupId === "string" ? assignment.groupId : "";
};

const getRegisteredEmailRef = (email: string) =>
  doc(db, "registeredEmails", normalizeEmail(email));

const upsertRegisteredEmail = async (profile: UserProfile) => {
  if (!profile.email) return;

  try {
    await setDoc(getRegisteredEmailRef(profile.email), {
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

const getGroupOwnerUid = async (groupId: string) => {
  if (!groupId) return "";

  const groupSnap = await getDoc(doc(db, "groups", groupId));
  if (!groupSnap.exists()) return "";

  const group = groupSnap.data();
  return typeof group.ownerUid === "string" ? group.ownerUid : "";
};

const getUserRole = async (uid: string, groupId: string): Promise<UserRole> => {
  const ownerUid = await getGroupOwnerUid(groupId);

  return ownerUid && ownerUid === uid ? "admin" : "member";
};

export const ensureUserProfile = async (user: User) => {
  const email = normalizeEmail(user.email || "");

  if (pendingProfile?.uid === user.uid) {
    return pendingProfile.promise;
  }

  const promise = ensureUserProfileRemote(user, email);
  pendingProfile = {
    uid: user.uid,
    promise,
  };

  try {
    return await promise;
  } finally {
    if (pendingProfile?.promise === promise) {
      pendingProfile = null;
    }
  }
};

const ensureUserProfileRemote = async (user: User, email: string) => {
  const userRef = doc(db, "users", user.uid);

  const userSnap = await getDoc(userRef);
  const assignedGroupId = await getAssignedGroupId(email);

  if (userSnap.exists()) {
    const profile = userSnap.data() as UserProfile;
    const currentRole = await getUserRole(user.uid, profile.groupId);

    if (
      assignedGroupId &&
      assignedGroupId !== profile.groupId &&
      currentRole === "admin"
    ) {
      await upsertRegisteredEmail({
        ...profile,
        name: getUserName(user),
        email,
        role: currentRole,
      });
      throw new ExistingOwnerAccountError();
    }

    const groupId = assignedGroupId || profile.groupId;
    const role =
      assignedGroupId && assignedGroupId !== profile.groupId
        ? "member"
        : await getUserRole(user.uid, groupId);

    await updateDoc(userRef, {
      name: getUserName(user),
      email,
      groupId,
      role,
      lastLogin: serverTimestamp(),
    });

    const nextProfile = {
      ...profile,
      name: getUserName(user),
      email,
      groupId,
      role,
    };

    await upsertRegisteredEmail(nextProfile);

    return nextProfile;
  }

  const now = serverTimestamp();
  const name = getUserName(user);
  let groupId = assignedGroupId;

  if (!groupId) {
    const groupRef = doc(collection(db, "groups"));
    groupId = groupRef.id;

    await setDoc(groupRef, {
      name: `Familia ${name}`,
      ownerUid: user.uid,
      createdAt: now,
      updatedAt: now,
    });
  }

  const profile: UserProfile = {
    uid: user.uid,
    name,
    email,
    groupId,
    role: assignedGroupId ? "member" : "admin",
  };

  await setDoc(userRef, {
    ...profile,
    createdAt: now,
    lastLogin: now,
  });

  await upsertRegisteredEmail(profile);

  return profile;
};

export const getGroupMembers = async (groupId: string) => {
  if (!groupId) return [];

  const [usersSnap, assignmentsSnap, ownerUid] = await Promise.all([
    getDocs(query(collection(db, "users"), where("groupId", "==", groupId))),
    getDocs(
      query(collection(db, "groupAssignments"), where("groupId", "==", groupId))
    ),
    getGroupOwnerUid(groupId),
  ]);

  const activeMembers = usersSnap.docs.map((item) => {
    const user = item.data() as UserProfile;

    return {
      id: user.uid || item.id,
      name: user.name || "",
      email: user.email || "",
      groupId: user.groupId,
      status: "active" as const,
      role: user.uid === ownerUid ? ("admin" as const) : ("member" as const),
    };
  });

  const activeEmails = new Set(activeMembers.map((item) => item.email));

  const pendingMembers = assignmentsSnap.docs
    .map((item) => {
      const assignment = item.data();
      const email =
        typeof assignment.email === "string" ? assignment.email : item.id;
      const name =
        typeof assignment.name === "string" ? assignment.name.trim() : "";

      return {
        id: item.id,
        name,
        email,
        groupId:
          typeof assignment.groupId === "string" ? assignment.groupId : groupId,
        status: "pending" as const,
        role: "member" as const,
      };
    })
    .filter((item) => !activeEmails.has(item.email));

  return [...activeMembers, ...pendingMembers].sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return String(a.name || a.email).localeCompare(String(b.name || b.email));
  });
};

export const createGroupAssignment = async (
  name: string,
  email: string,
  groupId: string,
  createdByUid: string
) => {
  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedName || !normalizedEmail || !groupId || !createdByUid) {
    throw new Error("Dados invalidos para cadastrar membro.");
  }

  const [registeredEmailSnap, assignmentSnap] = await Promise.all([
    getDoc(getRegisteredEmailRef(normalizedEmail)),
    getDocs(
      query(
        collection(db, "groupAssignments"),
        where("groupId", "==", groupId),
        where("email", "==", normalizedEmail)
      )
    ),
  ]);

  if (registeredEmailSnap.exists()) {
    throw new RegisteredEmailAlreadyExistsError();
  }

  if (!assignmentSnap.empty) {
    throw new Error("Este e-mail ja possui um convite pendente.");
  }

  await setDoc(doc(db, "groupAssignments", normalizedEmail), {
    name: normalizedName,
    email: normalizedEmail,
    groupId,
    createdByUid,
    createdAt: serverTimestamp(),
    status: "pending",
  });
};

export const deleteGroupMember = async (member: GroupMemberListItem) => {
  if (member.role === "admin") {
    throw new Error("O administrador do grupo nao pode ser removido.");
  }

  const normalizedEmail = normalizeEmail(member.email);

  if (member.status === "pending") {
    await deleteDoc(doc(db, "groupAssignments", normalizedEmail));
    return;
  }

  await deleteDoc(doc(db, "users", member.id));

  if (normalizedEmail) {
    const assignmentRef = doc(db, "groupAssignments", normalizedEmail);
    const assignmentSnap = await getDoc(assignmentRef);

    if (assignmentSnap.exists()) {
      await deleteDoc(assignmentRef);
    }
  }
};

const commitDeleteRefs = async (
  refs: Array<DocumentReference<DocumentData>>
) => {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(db);

    refs.slice(index, index + 450).forEach((ref) => {
      batch.delete(ref);
    });

    await batch.commit();
  }
};

const getGroupCollectionRefs = async (collectionName: string, groupId: string) => {
  const snap = await getDocs(
    query(collection(db, collectionName), where("groupId", "==", groupId))
  );

  return snap.docs.map((item) => item.ref);
};

export const deleteCurrentUserAccount = async (profile: UserProfile) => {
  if (!profile?.uid || !profile.groupId) {
    throw new Error("Conta invalida para exclusao.");
  }

  const role = await getUserRole(profile.uid, profile.groupId);
  const refsToDelete: Array<DocumentReference<DocumentData>> = [];

  if (role === "admin") {
    const monthsSnap = await getDocs(
      query(collection(db, "months"), where("groupId", "==", profile.groupId))
    );

    for (const monthDoc of monthsSnap.docs) {
      const [accountsSnap, transactionsSnap] = await Promise.all([
        getDocs(collection(db, "months", monthDoc.id, "accounts")),
        getDocs(collection(db, "months", monthDoc.id, "transactions")),
      ]);

      accountsSnap.docs.forEach((item) => refsToDelete.push(item.ref));
      transactionsSnap.docs.forEach((item) => refsToDelete.push(item.ref));
      refsToDelete.push(monthDoc.ref);
    }

    const groupedCollections = await Promise.all(
      [
        "categories",
        "investments",
        "settings",
        "configurations",
        "installmentPurchases",
        "groupAssignments",
        "users",
        "registeredEmails",
      ].map((collectionName) =>
        getGroupCollectionRefs(collectionName, profile.groupId)
      )
    );

    groupedCollections.flat().forEach((ref) => refsToDelete.push(ref));
    refsToDelete.push(doc(db, "groups", profile.groupId));
  } else {
    refsToDelete.push(doc(db, "users", profile.uid));

    if (profile.email) {
      refsToDelete.push(getRegisteredEmailRef(profile.email));
    }
  }

  await commitDeleteRefs(refsToDelete);
};
