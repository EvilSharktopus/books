"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Emulator support for local development/testing:
// set NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.projectId && (firebaseConfig.apiKey || EMULATOR_HOST)
);

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firestore is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables (see .env.local.example)."
    );
  }
  if (!db) {
    const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
    db = getFirestore(app);
    if (EMULATOR_HOST) {
      const [host, port] = EMULATOR_HOST.split(":");
      connectFirestoreEmulator(db, host, parseInt(port, 10));
    }
  }
  return db;
}
