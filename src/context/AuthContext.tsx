"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { isAdmin } from "@/lib/auth";
import type { AppwriteUser, Employee } from "@/types";
import { Query } from "appwrite";

interface AuthContextValue {
  user: AppwriteUser | null;
  employee: Employee | null;
  isAdminUser: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  employee: null,
  isAdminUser: false,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      // Use server-side session cookie via /api/auth/me
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        setEmployee(null);
        return;
      }
      const data = await res.json() as AppwriteUser & { _sessionToken?: string; _projectId?: string };
      const { _sessionToken, _projectId, ...u } = data;
      // Restore Appwrite browser SDK session so database calls work after page reload
      if (typeof window !== "undefined" && _sessionToken && _projectId) {
        window.localStorage.setItem(
          "cookieFallback",
          JSON.stringify({ [`a_session_${_projectId}`]: _sessionToken })
        );
      }
      setUser(u as AppwriteUser);

      // Fetch employee record using Appwrite SDK (still works client-side with proper permissions)
      try {
        const empRes = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
          Query.equal("userId", u.$id),
          Query.limit(1),
        ]);
        setEmployee((empRes.documents[0] as unknown as Employee) ?? null);
      } catch {
        setEmployee(null);
      }
    } catch {
      setUser(null);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AuthContext.Provider value={{
      user,
      employee,
      isAdminUser: isAdmin(user),
      loading,
      refresh: load,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
