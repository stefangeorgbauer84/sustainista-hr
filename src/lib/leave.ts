import { supabase } from './supabase'
import type { Absence, AbsenceType, LeaveBalance } from '@/types'
import { addDays, parseISO } from 'date-fns'

export function calcBusinessDays(start: string, end: string, holidays: string[]): number {
  let count = 0
  let current = parseISO(start)
  const endDate = parseISO(end)
  while (current <= endDate) {
    const iso = current.toISOString().split('T')[0]
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6 && !holidays.includes(iso)) count++
    current = addDays(current, 1)
  }
  return count
}

export async function getHolidaysForYear(year: number): Promise<string[]> {
  const { data } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .eq('country', 'AT')
    .is('federal_state', null)
    .eq('year', year)
  return (data ?? []).map((h) => h.holiday_date)
}

export async function getAbsenceTypes(): Promise<AbsenceType[]> {
  const { data, error } = await supabase
    .from('absence_types')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createAbsence(payload: {
  absence_type_id: string
  start_date: string
  end_date: string
  reason?: string
  deputy_id?: string
  working_days: number
}): Promise<Absence> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_id, company_id')
    .eq('id', user!.id)
    .single()

  const { data, error } = await supabase
    .from('absences')
    .insert({
      ...payload,
      employee_id: profile!.employee_id,
      company_id: profile!.company_id,
      requested_by: user!.id,
      status: 'requested',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAbsencesForEmployee(employeeId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function getAllPendingAbsences(): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select('*, employees!employee_id(first_name, last_name), absence_types(name, color_hex)')
    .eq('status', 'requested')
    .order('start_date')
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function approveAbsence(id: string): Promise<Absence> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('absences')
    .update({ status: 'approved', approved_by: user!.id, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function rejectAbsence(id: string, rejection_note?: string): Promise<Absence> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('absences')
    .update({
      status: 'rejected',
      approved_by: user!.id,
      approved_at: new Date().toISOString(),
      ...(rejection_note ? { rejection_note } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | null> {
  const { data } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .single()
  return data ?? null
}

export async function getApprovedAbsencesForCalendar(): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select('*, employees!employee_id(first_name, last_name), absence_types(name, code, color_hex)')
    .eq('status', 'approved')
    .order('start_date')
    .limit(200)
  if (error) throw error
  return data ?? []
}
