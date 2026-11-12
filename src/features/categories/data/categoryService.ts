import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { FinanceCategory } from "../../../domain/finance/category";

const genericDefaultCategories = [
  "Alimenta\u00e7\u00e3o",
  "Farm\u00e1cia",
  "Supermercado",
  "Est\u00e9tica",
];

const legacyDefaultCategories = [
  "Alimenta\u00e7\u00e3o",
  "Roles",
  "Farm\u00e1cia",
  "Casa",
  "Supermercado",
  "Uber e etc",
  "Cabeleireiro",
  "Gastos Carro",
  "Ped\u00e1gios",
  "Gastos Matheus",
  "Gastos Giovana",
  "Academia",
  "Doa\u00e7\u00f5es",
  "Descontos Antecipa\u00e7\u00e3o Nu",
];

type SeedDefaultCategoriesOptions = {
  preset?: "generic" | "legacy";
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getCategoryDocId = (groupId: string, name: string) =>
  `${groupId}_${slugify(name)}`;

export const getGroupCategories = async (groupId: string, firestore: Firestore) => {
  if (!groupId) return [];

  const snap = await getDocs(
    query(collection(firestore, "categories"), where("groupId", "==", groupId))
  );

  return snap.docs
    .map((item, index) => {
      const data = item.data();

      return {
        id: item.id,
        name: String(data.name || ""),
        groupId: String(data.groupId || groupId),
        order: Number.isFinite(Number(data.order)) ? Number(data.order) : index,
        isActive: data.isActive !== false,
      } as FinanceCategory;
    })
    .filter((item) => item.name && item.isActive)
    .sort((a, b) => {
      const orderDiff = Number(a.order || 0) - Number(b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
};

export const seedDefaultCategoriesForGroup = async (
  groupId: string,
  options: SeedDefaultCategoriesOptions = {},
  firestore: Firestore,
) => {
  if (!groupId) return [];

  const existing = await getGroupCategories(groupId, firestore);
  if (existing.length > 0) return existing;

  const batch = writeBatch(firestore);
  const now = serverTimestamp();
  const categories =
    options.preset === "legacy"
      ? legacyDefaultCategories
      : genericDefaultCategories;

  categories.forEach((name, order) => {
    batch.set(doc(firestore, "categories", getCategoryDocId(groupId, name)), {
      name,
      groupId,
      order,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();

  return getGroupCategories(groupId, firestore);
};

export const createCategory = async (
  groupId: string,
  name: string,
  order: number,
  firestore: Firestore,
) => {
  const trimmedName = name.trim();

  if (!groupId || !trimmedName) {
    throw new Error("Dados invalidos para cadastrar categoria.");
  }

  const now = serverTimestamp();
  const categoryRef = doc(firestore, "categories", getCategoryDocId(groupId, name));

  await setDoc(categoryRef, {
    name: trimmedName,
    groupId,
    order,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: categoryRef.id,
    name: trimmedName,
    groupId,
    order,
    isActive: true,
  } as FinanceCategory;
};

export const updateCategoryName = async (
  categoryId: string,
  name: string,
  firestore: Firestore,
) => {
  const trimmedName = name.trim();

  if (!categoryId || !trimmedName) {
    throw new Error("Dados invalidos para editar categoria.");
  }

  await updateDoc(doc(firestore, "categories", categoryId), {
    name: trimmedName,
    updatedAt: serverTimestamp(),
  });

  return trimmedName;
};

export const deleteCategory = async (
  categoryId: string,
  firestore: Firestore,
) => {
  if (!categoryId) {
    throw new Error("Categoria invalida.");
  }

  await deleteDoc(doc(firestore, "categories", categoryId));
};
