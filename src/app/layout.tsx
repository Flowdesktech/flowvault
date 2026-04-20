import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_URL } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE =
  "Flowvault — zero-knowledge encrypted notepad with plausible deniability";
const DESCRIPTION =
  "A private, encrypted online notepad. Your notes never leave your browser in plaintext. Multiple passwords unlock different notebooks on the same URL — a deniable alternative to ProtectedText, Standard Notes, CryptPad, and Privnote, with a fully open-source frontend, Cloud Functions, and Firestore rules.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: "%s — Flowvault",
  },
  description: DESCRIPTION,
  applicationName: "Flowvault",
  keywords: [
    "encrypted notepad",
    "online notepad",
    "zero knowledge notes",
    "plausible deniability notes",
    "ProtectedText alternative",
    "Standard Notes alternative",
    "CryptPad alternative",
    "Privnote alternative",
    "Notesnook alternative",
    "Skiff Notes alternative",
    "anonymous notepad",
    "notepad without account",
    "encrypted notes browser",
    "Argon2 notes",
    "AES-GCM notes",
    "Flowvault",
    "Flowdesk",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Flowvault",
    url: APP_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
