import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
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
  type Firestore,
} from "firebase/firestore";
import type { UserProfile } from "../../../domain/finance/userProfile";
import type { GroupMemberListItem, UserRole } from "../../../domain/finance/groupMember";

export class RegisteredEmailAlreadyExistsError extends Error {
  constructor() {
    super("Usuario ja cadastrado.");
    this.name = "RegisteredEmailAlreadyExistsError";
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const applySpaceTheme = (space: "family" | "personal") => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = space;
};

const getRegisteredEmailRef = (email: string, firestore: Firestore) =>
  doc(firestore, "registeredEmails", normalizeEmail(email));

const getGroupOwnerUid = async (groupId: string, firestore: Firestore) => {
  if (!groupId) return "";

  const groupSnap = await getDoc(doc(firestore, "groups", groupId));
  if (!groupSnap.exists()) return "";

  const group = groupSnap.data();
  return typeof group.ownerUid === "string" ? group.ownerUid : "";
};

const getUserRole = async (uid: string, groupId: string, firestore: Firestore): Promise<UserRole> => {
  const ownerUid = await getGroupOwnerUid(groupId, firestore);

  return ownerUid && ownerUid === uid ? "admin" : "member";
};

export const setActiveSpace = async (
  user: User,
  activeSpace: "family" | "personal",
  firestore: Firestore,
) => {
  await updateDoc(doc(firestore, "users", user.uid), { activeSpace });
  applySpaceTheme(activeSpace);
};

export const getGroupMembers = async (groupId: string, firestore: Firestore) => {
  if (!groupId) return [];

  const [usersSnap, assignmentsSnap, ownerUid] = await Promise.all([
    getDocs(query(collection(firestore, "users"), where("groupId", "==", groupId))),
    getDocs(
      query(collection(firestore, "groupAssignments"), where("groupId", "==", groupId))
    ),
    getGroupOwnerUid(groupId, firestore),
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

  if (ownerUid && !activeMembers.some((member) => member.id === ownerUid)) {
    const ownerSnap = await getDoc(doc(firestore, "users", ownerUid));
    if (ownerSnap.exists()) {
      const owner = ownerSnap.data() as UserProfile;
      if (owner.personalGroupId === groupId) {
        activeMembers.push({
          id: owner.uid,
          name: owner.name,
          email: owner.email,
          groupId,
          status: "active",
          role: "admin",
        });
      }
    }
  }

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
  createdByUid: string,
  firestore: Firestore,
) => {
  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedName || !normalizedEmail || !groupId || !createdByUid) {
    throw new Error("Dados invalidos para cadastrar membro.");
  }

  const [registeredEmailSnap, assignmentSnap] = await Promise.all([
    getDoc(getRegisteredEmailRef(normalizedEmail, firestore)),
    getDocs(
      query(
        collection(firestore, "groupAssignments"),
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

  await setDoc(doc(firestore, "groupAssignments", normalizedEmail), {
    name: normalizedName,
    email: normalizedEmail,
    groupId,
    createdByUid,
    createdAt: serverTimestamp(),
    status: "pending",
  });
};

export const deleteGroupMember = async (
  member: GroupMemberListItem,
  firestore: Firestore,
) => {
  if (member.role === "admin") {
    throw new Error("O administrador do grupo nao pode ser removido.");
  }

  const normalizedEmail = normalizeEmail(member.email);

  if (member.status === "pending") {
    await deleteDoc(doc(firestore, "groupAssignments", normalizedEmail));
    return;
  }

  await deleteDoc(doc(firestore, "users", member.id));

  if (normalizedEmail) {
    const assignmentRef = doc(firestore, "groupAssignments", normalizedEmail);
    const assignmentSnap = await getDoc(assignmentRef);

    if (assignmentSnap.exists()) {
      await deleteDoc(assignmentRef);
    }
  }
};

const commitDeleteRefs = async (
  refs: Array<DocumentReference<DocumentData>>,
  firestore: Firestore,
) => {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(firestore);

    refs.slice(index, index + 450).forEach((ref) => {
      batch.delete(ref);
    });

    await batch.commit();
  }
};

const getGroupCollectionRefs = async (collectionName: string, groupId: string, firestore: Firestore) => {
  const snap = await getDocs(
    query(collection(firestore, collectionName), where("groupId", "==", groupId))
  );

  return snap.docs.map((item) => item.ref);
};

export const deleteCurrentUserAccount = async (profile: UserProfile, firestore: Firestore) => {
  if (!profile?.uid || !profile.groupId) {
    throw new Error("Conta invalida para exclusao.");
  }

  const role = await getUserRole(profile.uid, profile.groupId, firestore);
  const refsToDelete: Array<DocumentReference<DocumentData>> = [];

  if (profile.personalGroupId === profile.groupId) {
    const monthsSnap = await getDocs(
      query(collection(firestore, "months"), where("groupId", "==", profile.groupId)),
    );
    for (const monthDoc of monthsSnap.docs) {
      const [accountsSnap, transactionsSnap] = await Promise.all([
        getDocs(collection(firestore, "months", monthDoc.id, "accounts")),
        getDocs(collection(firestore, "months", monthDoc.id, "transactions")),
      ]);
      accountsSnap.docs.forEach((item) => refsToDelete.push(item.ref));
      transactionsSnap.docs.forEach((item) => refsToDelete.push(item.ref));
      refsToDelete.push(monthDoc.ref);
    }
    const groupedCollections = await Promise.all(
      ["categories", "investments", "settings", "configurations", "installmentPurchases", "groupAssignments"].map(
        (collectionName) => getGroupCollectionRefs(collectionName, profile.groupId, firestore),
      ),
    );
    groupedCollections.flat().forEach((ref) => refsToDelete.push(ref));
    refsToDelete.push(doc(firestore, "groups", profile.groupId));
    await commitDeleteRefs(refsToDelete, firestore);
    await updateDoc(doc(firestore, "users", profile.uid), {
      personalGroupId: deleteField(),
      activeSpace: "family",
    });
    return;
  }

  if (role === "admin") {
    const monthsSnap = await getDocs(
      query(collection(firestore, "months"), where("groupId", "==", profile.groupId))
    );

    for (const monthDoc of monthsSnap.docs) {
      const [accountsSnap, transactionsSnap] = await Promise.all([
        getDocs(collection(firestore, "months", monthDoc.id, "accounts")),
        getDocs(collection(firestore, "months", monthDoc.id, "transactions")),
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
        getGroupCollectionRefs(collectionName, profile.groupId, firestore)
      )
    );

    groupedCollections.flat().forEach((ref) => refsToDelete.push(ref));
    refsToDelete.push(doc(firestore, "groups", profile.groupId));
  } else {
    refsToDelete.push(doc(firestore, "users", profile.uid));

    if (profile.email) {
      refsToDelete.push(getRegisteredEmailRef(profile.email, firestore));
    }
  }

  await commitDeleteRefs(refsToDelete, firestore);
};
