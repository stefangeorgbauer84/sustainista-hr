import { account } from "./appwrite";
import { AppwriteException, ID, OAuthProvider } from "appwrite";

export async function login(email: string, password: string): Promise<{ isAdmin: boolean }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Login fehlgeschlagen");
  }
  const data = await res.json();
  // Store session in localStorage so Appwrite browser SDK can use it for database calls
  if (typeof window !== "undefined" && data.sessionToken && data.projectId) {
    window.localStorage.setItem(
      "cookieFallback",
      JSON.stringify({ [`a_session_${data.projectId}`]: data.sessionToken })
    );
  }
  return { isAdmin: data.isAdmin };
}

export async function logout() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("cookieFallback");
  }
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function createAccount(email: string, password: string, name: string) {
  return account.create(ID.unique(), email, password, name);
}

export function isAdmin(user: { labels?: string[] } | null): boolean {
  return user?.labels?.includes("admin") ?? false;
}

export function loginWithGoogle(origin: string) {
  const success = `${origin}/auth/callback`;
  const failure = `${origin}/auth/callback?error=google`;
  account.createOAuth2Session(OAuthProvider.Google, success, failure);
}

export function loginWithMicrosoft(origin: string) {
  const success = `${origin}/auth/callback`;
  const failure = `${origin}/auth/callback?error=microsoft`;
  account.createOAuth2Session(OAuthProvider.Microsoft, success, failure);
}
