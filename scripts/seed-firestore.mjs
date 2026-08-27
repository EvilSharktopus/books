// Imports data/seed-ratings.jsonl (the original Google Sheet data) into
// Firestore under users/{userId}/books, mapping the old flat schema to
// the multi-user book model.
//
// Usage:
//   node scripts/seed-firestore.mjs "<user name>"
//
// Reads the Firebase config from the NEXT_PUBLIC_FIREBASE_* variables in
// .env.local (or the environment). Set NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST
// to target a local emulator instead of production.
// Creates the named user if it doesn't exist, then skips any book whose
// title+authors+rating+notes already exist for that user, so re-running
// is safe while genuine re-reads (same book, different rating) import.

import { readFileSync, existsSync } from "fs";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

// Minimal .env.local loader (no dependency on dotenv)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

const userName = process.argv[2];
if (!userName) {
  console.error('Usage: node scripts/seed-firestore.mjs "<user name>"');
  process.exit(1);
}

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (!config.projectId) {
  console.error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set (see .env.local.example).");
  process.exit(1);
}

const app = initializeApp(config);
const db = getFirestore(app);
const emulator = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
if (emulator) {
  const [host, port] = emulator.split(":");
  connectFirestoreEmulator(db, host, parseInt(port, 10));
  console.log(`Using Firestore emulator at ${emulator}`);
}

// Find or create the user
const usersRef = collection(db, "users");
const existing = await getDocs(query(usersRef, where("name", "==", userName)));
let userId;
if (existing.docs.length > 0) {
  userId = existing.docs[0].id;
  console.log(`Found existing user "${userName}" (${userId})`);
} else {
  const ref = await addDoc(usersRef, { name: userName });
  userId = ref.id;
  console.log(`Created user "${userName}" (${userId})`);
}

// Index existing books to make re-runs idempotent
const bookKey = (b) =>
  [b.title, b.authors, b.myRating ?? 0, b.notes ?? ""].join("|");
const booksRef = collection(db, "users", userId, "books");
const existingBooks = await getDocs(booksRef);
const seen = new Set(existingBooks.docs.map((d) => bookKey(d.data())));

const lines = readFileSync("data/seed-ratings.jsonl", "utf-8")
  .split("\n")
  .filter((l) => l.trim());

let added = 0;
let skipped = 0;
for (const line of lines) {
  const old = JSON.parse(line);
  const book = {
    title: old.bookTitle ?? "",
    authors: old.author ?? "",
    year: "",
    pages: "",
    cover: "",
    avgRating: null,
    source: old.source ?? "",
    myRating: old.rating ?? 0,
    notes: old.comments ?? "",
    cried: false,
    type: old.type ?? "",
    authorCountry: "",
    dateAdded: old.submittedAt
      ? Timestamp.fromDate(new Date(old.submittedAt))
      : serverTimestamp(),
  };
  const key = bookKey(book);
  if (seen.has(key)) {
    skipped++;
    continue;
  }
  await addDoc(booksRef, book);
  seen.add(key);
  added++;
}

console.log(`Done: ${added} books added, ${skipped} already present.`);
process.exit(0);
