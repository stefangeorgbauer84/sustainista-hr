import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./print.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Providers from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HR Tool — Mitarbeiterverwaltung",
  description: "Zeiterfassung, Urlaub & HR-Verwaltung",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} {...(nonce ? { nonce } : {})}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
