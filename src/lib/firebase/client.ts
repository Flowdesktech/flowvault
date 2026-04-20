/**
 * Firebase client SDK initialization. Used only in the browser.
 *
 * Config is supplied via NEXT_PUBLIC_* env vars. These are embedded in the
 * client bundle and are not secrets: the Firestore security rules are the
 * real boundary.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const REGION = process.env.NEXT_PUBLIC_FIREBASE_REGION ?? "us-central1";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _fn: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!firebaseConfig.projectId) {
    throw new Error(
      "Firebase config missing. Copy .env.local.example to .env.local and fill in your project values.",
    );
  }
  _app = getApps()[0] ?? initializeApp(firebaseConfig);
  return _app;
}

export function db(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  return _db;
}

export function fn(): Functions {
  if (_fn) return _fn;
  _fn = getFunctions(getFirebaseApp(), REGION);
  return _fn;
}
