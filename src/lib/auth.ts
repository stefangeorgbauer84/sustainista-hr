import { supabase } from './supabase'

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function loginWithGoogle(redirectTo: string) {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${redirectTo}/auth/callback` },
  })
}

export async function loginWithMicrosoft(redirectTo: string) {
  await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: `${redirectTo}/auth/callback` },
  })
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
