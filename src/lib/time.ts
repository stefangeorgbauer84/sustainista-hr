import { supabase } from './supabase'
import type { TimeRecord } from '@/types'

async function getMyEmployeeId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('profiles')
    .select('employee_id')
    .eq('id', user!.id)
    .single()
  return data!.employee_id
}

export async function startTimer(note?: string): Promise<TimeRecord> {
  const employeeId = await getMyEmployeeId()
  const now = new Date()
  const { data, error } = await supabase
    .from('time_records')
    .insert({
      employee_id: employeeId,
      work_date: now.toISOString().split('T')[0],
      start_time: now.toTimeString().slice(0, 5),
      break_minutes: 0,
      status: 'draft',
      notes: note ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function stopTimer(recordId: string): Promise<TimeRecord> {
  const now = new Date()
  const { data, error } = await supabase
    .from('time_records')
    .update({ end_time: now.toTimeString().slice(0, 5) })
    .eq('id', recordId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getRunningEntry(): Promise<TimeRecord | null> {
  const employeeId = await getMyEmployeeId()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('time_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', today)
    .is('end_time', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

export async function getTimeRecordsForEmployee(
  employeeId: string,
  year: number,
  month: number
): Promise<TimeRecord[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-31`
  const { data, error } = await supabase
    .from('time_records')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export function calcWorkedMinutes(record: TimeRecord): number {
  if (!record.end_time) return 0
  const [sh, sm] = record.start_time.split(':').map(Number)
  const [eh, em] = record.end_time.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm) - record.break_minutes
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
