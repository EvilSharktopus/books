"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { BookDoc } from "@/lib/books";

export type RecStatus = "pending" | "accepted" | "dismissed";

export interface Recommendation {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string | null;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  note: string | null;
  status: RecStatus;
  createdAt: Timestamp | null;
}

function recsCollection() {
  return collection(getDb(), "recommendations");
}

function mapRec(id: string, data: Record<string, unknown>): Recommendation {
  return {
    id,
    bookId: (data.bookId as string) ?? "",
    bookTitle: (data.bookTitle as string) ?? "",
    bookAuthor: (data.bookAuthor as string) ?? "",
    bookCoverUrl: (data.bookCoverUrl as string | null) ?? null,
    fromUserId: (data.fromUserId as string) ?? "",
    fromUserName: (data.fromUserName as string) ?? "",
    toUserId: (data.toUserId as string) ?? "",
    note: (data.note as string | null) ?? null,
    status: (data.status as RecStatus) ?? "pending",
    createdAt: (data.createdAt as Timestamp | null) ?? null,
  };
}

/** Send one recommendation doc per recipient. Denormalizes book fields. */
export async function sendRecommendations(
  book: BookDoc,
  from: { id: string; name: string },
  toUserIds: string[],
  note: string
): Promise<void> {
  const trimmed = note.trim().slice(0, 140);
  await Promise.all(
    toUserIds.map((toUserId) =>
      addDoc(recsCollection(), {
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.authors,
        bookCoverUrl: book.cover || null,
        fromUserId: from.id,
        fromUserName: from.name,
        toUserId,
        note: trimmed || null,
        status: "pending" as RecStatus,
        createdAt: serverTimestamp(),
      })
    )
  );
}

/** Recommendations the current user has already sent for one book. */
export async function listSentForBook(
  fromUserId: string,
  bookId: string
): Promise<Recommendation[]> {
  const snap = await getDocs(
    query(
      recsCollection(),
      where("fromUserId", "==", fromUserId),
      where("bookId", "==", bookId)
    )
  );
  return snap.docs.map((d) => mapRec(d.id, d.data()));
}

/** Live inbox listener: pending recs addressed to this user. */
export function listenInbox(
  toUserId: string,
  cb: (recs: Recommendation[]) => void
): () => void {
  const q = query(recsCollection(), where("toUserId", "==", toUserId));
  return onSnapshot(
    q,
    (snap) => {
      const recs = snap.docs
        .map((d) => mapRec(d.id, d.data()))
        .filter((r) => r.status === "pending")
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      cb(recs);
    },
    (err) => {
      console.error("[recs] inbox listener failed:", err);
      cb([]);
    }
  );
}

export async function setRecommendationStatus(
  recId: string,
  status: RecStatus
): Promise<void> {
  await updateDoc(doc(getDb(), "recommendations", recId), { status });
}
