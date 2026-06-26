"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import type { User, Session, Profile, Employee, Company } from "@/types"

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  employee: Employee | null
  realEmployee: Employee | null
  company: Company | null
  isAdminUser: boolean
  isSuperAdmin: boolean
  isImpersonating: boolean
  loading: boolean
  refresh: () => Promise<void>
  viewAs: (emp: Employee | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  employee: null,
  realEmployee: null,
  company: null,
  isAdminUser: false,
  isSuperAdmin: false,
  isImpersonating: false,
  loading: true,
  refresh: async () => {},
  viewAs: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [viewAsEmployee, setViewAsEmployee] = useState<Employee | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
      setProfile(p ?? null)

      if (p?.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("id, name, slug, legal_name, brand_config, settings, subscription_tier, is_active, created_at, updated_at")
          .eq("id", p.company_id)
          .single()
        setCompany(c ?? null)
      } else {
        setCompany(null)
      }

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
      setCompany(null)
    }
  }

  async function refresh() {
    const { data: { session: s } } = await supabase.auth.getSession()
    setSession(s)
    setUser(s?.user ?? null)
    if (s?.user) await loadProfile(s.user.id)
    else { setProfile(null); setEmployee(null); setViewAsEmployee(null); setCompany(null) }
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
      else { setProfile(null); setEmployee(null); setViewAsEmployee(null); setCompany(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isSuperAdmin = profile?.role === "super_admin"
  const isAdminUser = isSuperAdmin ||
    profile?.role === "company_admin" ||
    profile?.role === "hr_manager"

  const effectiveEmployee = viewAsEmployee ?? employee
  const isImpersonating = viewAsEmployee !== null

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      employee: effectiveEmployee,
      realEmployee: employee,
      company, isAdminUser, isSuperAdmin,
      isImpersonating, loading, refresh,
      viewAs: setViewAsEmployee,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
