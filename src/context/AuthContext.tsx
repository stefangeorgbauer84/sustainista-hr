"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import type { User, Session, Profile, Employee } from "@/types"

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  employee: Employee | null
  isAdminUser: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  employee: null,
  isAdminUser: false,
  loading: true,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
      setProfile(p ?? null)

      if (p?.employee_id) {
        const { data: e } = await supabase
          .from("employees")
          .select("*")
          .eq("id", p.employee_id)
          .single()
        setEmployee(e ?? null)
      } else {
        setEmployee(null)
      }
    } catch {
      setProfile(null)
      setEmployee(null)
    }
  }

  async function refresh() {
    const { data: { session: s } } = await supabase.auth.getSession()
    setSession(s)
    setUser(s?.user ?? null)
    if (s?.user) await loadProfile(s.user.id)
    else { setProfile(null); setEmployee(null) }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) loadProfile(s.user.id)
      else { setProfile(null); setEmployee(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdminUser = profile?.role === "company_admin" ||
    profile?.role === "super_admin" ||
    profile?.role === "hr_manager"

  return (
    <AuthContext.Provider value={{ user, session, profile, employee, isAdminUser, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
