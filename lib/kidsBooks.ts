"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { AppUser } from "./books";

export interface KidsBookFields {
  title: string;
  author: string;
  coverUrl: string;
  format: "Graphic Novel" | "Chapter Book" | "Other";
  rating: "loved" | "liked" | "okay" | "not_for_me"; // 😍 / 🙂 / 😐 / 👎
  favoritePart?: string;
  artStyle?: string;
  artStyleOther?: string;
  isSeries: boolean;
  seriesName?: string;
  seriesBookNumber?: number;
  seriesTotalBooks?: number;
  willReadNext?: "yes" | "not_sure" | "no";
  favoriteInSeries?: boolean;
}

export interface KidsBookDoc extends KidsBookFields {
  id: string;
  dateAdded: Timestamp | null;
}

export interface MiaUser extends AppUser {
  miaPalette?: string;
}

export async function getOrCreateMiaUser(): Promise<MiaUser> {
  const usersRef = collection(getDb(), "users");
  const snap = await getDocs(usersRef);
  const miaDoc = snap.docs.find(
    (d: QueryDocumentSnapshot<DocumentData>) => (d.data().name as string | undefined)?.toLowerCase() === "mia"
  );

  if (miaDoc) {
    const data = miaDoc.data();
    return {
      id: miaDoc.id,
      name: data.name as string,
      miaPalette: data.miaPalette as string | undefined,
    };
  }

  // Create Mia if she doesn't exist
  const ref = await addDoc(usersRef, { name: "Mia", miaPalette: "classic" });
  return { id: ref.id, name: "Mia", miaPalette: "classic" };
}

export async function saveMiaPalette(userId: string, paletteName: string): Promise<void> {
  const userRef = doc(getDb(), "users", userId);
  await updateDoc(userRef, { miaPalette: paletteName });
}

function kidsBooksCollection(userId: string) {
  return collection(getDb(), "users", userId, "kidsBooks");
}

export async function addKidsBook(userId: string, fields: KidsBookFields): Promise<string> {
  const ref = await addDoc(kidsBooksCollection(userId), {
    ...fields,
    dateAdded: serverTimestamp(),
  });
  return ref.id;
}

export async function listKidsBooks(userId: string): Promise<KidsBookDoc[]> {
  const snap = await getDocs(
    query(kidsBooksCollection(userId), orderBy("dateAdded", "desc"))
  );
  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
    const data = d.data();
    return {
      id: d.id,
      title: (data.title as string) ?? "",
      author: (data.author as string) ?? "",
      coverUrl: (data.coverUrl as string) ?? "",
      format: (data.format as "Graphic Novel" | "Chapter Book" | "Other") ?? "Other",
      rating: (data.rating as "loved" | "liked" | "okay" | "not_for_me") ?? "okay",
      favoritePart: (data.favoritePart as string) ?? "",
      artStyle: (data.artStyle as string) ?? "",
      artStyleOther: (data.artStyleOther as string) ?? "",
      isSeries: (data.isSeries as boolean) ?? false,
      seriesName: (data.seriesName as string) ?? "",
      seriesBookNumber: (data.seriesBookNumber as number) ?? undefined,
      seriesTotalBooks: (data.seriesTotalBooks as number) ?? undefined,
      willReadNext: (data.willReadNext as "yes" | "not_sure" | "no") ?? undefined,
      favoriteInSeries: (data.favoriteInSeries as boolean) ?? false,
      dateAdded: (data.dateAdded as Timestamp | null) ?? null,
    };
  });
}

export async function updateKidsBook(
  userId: string,
  bookId: string,
  fields: Partial<KidsBookFields>
): Promise<void> {
  await updateDoc(doc(getDb(), "users", userId, "kidsBooks", bookId), fields);
}

export async function deleteKidsBook(userId: string, bookId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", userId, "kidsBooks", bookId));
}
