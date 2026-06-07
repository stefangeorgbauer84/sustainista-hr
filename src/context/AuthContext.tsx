"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
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
      const u = await account.get() as unknown as AppwriteUser;
      setUser(u);
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.EMPLOYEES, [
        Query.equal("userId", u.$id),
        Query.limit(1),
      ]);
      setEmployee((res.documents[0] as unknown as Employee) ?? null);
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
