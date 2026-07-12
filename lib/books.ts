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
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface AppUser {
  id: string;
  name: string;
}

// Fields written by the entry form. `type` and `authorCountry` are
// app-specific extras on top of the requested model.
export interface BookFields {
  title: string;
  authors: string;
  year: string;
  pages: string;
  cover: string;
  avgRating: number | null;
  source: string;
  myRating: number; // 1–10
  notes: string;
  cried: boolean;
  type: string;
  authorCountry: string;
  language: string;
  originalLanguage: string; // set when language is "Translated"
  season: string; // Spring | Summer | Autumn | Winter | ""
  edition: string; // e.g. "Penguin Classics, 2003"
  favorite: boolean; // max 4 per user, shown on the shelf's favourites row
}

export interface BookDoc extends BookFields {
  id: string;
  dateAdded: Timestamp | null; // null until serverTimestamp resolves
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(getDb(), "users"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? "" }));
}

export async function getUser(userId: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), "users", userId));
  if (!snap.exists()) return null;
  return { id: snap.id, name: (snap.data().name as string) ?? "" };
}

export async function addUser(name: string): Promise<AppUser> {
  const ref = await addDoc(collection(getDb(), "users"), { name });
  return { id: ref.id, name };
}

function booksCollection(userId: string) {
  return collection(getDb(), "users", userId, "books");
}

export async function addBook(userId: string, fields: BookFields): Promise<string> {
  const ref = await addDoc(booksCollection(userId), {
    ...fields,
    dateAdded: serverTimestamp(),
  });
  return ref.id;
}

export async function listBooks(userId: string): Promise<BookDoc[]> {
  const snap = await getDocs(
    query(booksCollection(userId), orderBy("dateAdded", "desc"))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: (data.title as string) ?? "",
      authors: (data.authors as string) ?? "",
      year: (data.year as string) ?? "",
      pages: (data.pages as string) ?? "",
      cover: (data.cover as string) ?? "",
      avgRating: (data.avgRating as number | null) ?? null,
      source: (data.source as string) ?? "",
      myRating: (data.myRating as number) ?? 0,
      notes: (data.notes as string) ?? "",
      cried: (data.cried as boolean) ?? false,
      type: (data.type as string) ?? "",
      authorCountry: (data.authorCountry as string) ?? "",
      language: (data.language as string) ?? "English",
      originalLanguage: (data.originalLanguage as string) ?? "",
      season: (data.season as string) ?? "",
      edition: (data.edition as string) ?? "",
      favorite: (data.favorite as boolean) ?? false,
      dateAdded: (data.dateAdded as Timestamp | null) ?? null,
    };
  });
}

export async function updateBook(
  userId: string,
  bookId: string,
  fields: Partial<BookFields>
): Promise<void> {
  await updateDoc(doc(getDb(), "users", userId, "books", bookId), fields);
}

export async function deleteBook(userId: string, bookId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", userId, "books", bookId));
}
