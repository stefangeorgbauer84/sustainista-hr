import { account } from "./appwrite";
import { AppwriteException, ID, OAuthProvider } from "appwrite";

export async function login(email: string, password: string) {
  return account.createEmailPasswordSession(email, password);
}

export async function logout() {
  return account.deleteSession("current");
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
