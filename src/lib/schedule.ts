import { supabase } from './supabase'
import type { ShiftSchedule, ScheduleChangeRequest } from '@/types'

export function calcShiftMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm) - breakMinutes
}

export function formatShiftHours(startTime: string, endTime: string, breakMinutes: number): string {
  const mins = calcShiftMinutes(startTime, endTime, breakMinutes)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

export async function getScheduleForLocation(locationId: string, weekStartStr: string): Promise<ShiftSchedule[]> {
  const weekEnd = addDays(new Date(weekStartStr), 6)
  const { data, error } = await supabase
    .from('shift_schedules')
    .select('*')
    .eq('location_id', locationId)
    .gte('scheduled_date', weekStartStr)
    .lte('scheduled_date', toDateStr(weekEnd))
    .order('scheduled_date')
  if (error) throw error
  return (data ?? []) as unknown as ShiftSchedule[]
}

export async function getScheduleForEmployee(
  employeeId: string, year: number, month: number
): Promise<(ShiftSchedule & { locations: { name: string } | null })[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('shift_schedules')
    .select('*, locations(name)')
    .eq('employee_id', employeeId)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .neq('status', 'cancelled')
    .order('scheduled_date')
  if (error) throw error
  return (data ?? []) as unknown as (ShiftSchedule & { locations: { name: string } | null })[]
}

type ChangeRequestWithJoins = ScheduleChangeRequest & {
  employees: { first_name: string; last_name: string } | null
  shift_schedules: { scheduled_date: string; start_time: string; end_time: string; location_id: string } | null
}

export async function getChangeRequests(status?: string): Promise<ChangeRequestWithJoins[]> {
  let query = supabase
    .from('schedule_change_requests')
    .select('*, employees(first_name, last_name), shift_schedules(scheduled_date, start_time, end_time, location_id)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as ChangeRequestWithJoins[]
}
