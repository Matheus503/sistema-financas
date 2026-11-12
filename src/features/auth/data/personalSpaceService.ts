import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import type { UserProfile } from "../../../domain/finance/userProfile";
import { createCurrentMonth } from "../../months/data/monthService";
import { seedDefaultCategoriesForGroup } from "../../categories/data/categoryService";

const getUserName = (user: User) =>
  user.displayName || user.email?.split("@")[0] || "Usuario";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const ensurePersonalSpace = async (user: User, firestore: Firestore) => {
  const userRef = doc(firestore, "users", user.uid);
  const groupRef = doc(collection(firestore, "groups"));
  const personalGroupId = await runTransaction(firestore, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("Perfil do usuário não encontrado.");
    const profile = userSnap.data() as UserProfile;
    if (profile.personalGroupId) return profile.personalGroupId;

    transaction.set(groupRef, {
      name: `Pessoal ${getUserName(user)}`,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      spaceType: "personal",
    });
    transaction.update(userRef, { personalGroupId: groupRef.id });
    return groupRef.id;
  });

  const legacyEmails = [
    "matheus.gomesmoreira@gmail.com",
    "giovana.bonardi96@gmail.com",
  ];
  const existingMonths = await getDocs(
    query(collection(firestore, "months"), where("groupId", "==", personalGroupId)),
  );
  if (existingMonths.empty) {
    await createCurrentMonth(user.uid, personalGroupId, firestore);
  }
  await seedDefaultCategoriesForGroup(
    personalGroupId,
    {
      preset: legacyEmails.includes(normalizeEmail(user.email || ""))
        ? "legacy"
        : "generic",
    },
    firestore,
  );
  return personalGroupId;
};
