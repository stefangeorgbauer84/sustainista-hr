import { supabase } from './supabase'
import type { TimeRecord } from '@/types'

async function getMyProfile(): Promise<{ employee_id: string; company_id: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('profiles')
    .select('employee_id, company_id')
    .eq('id', user!.id)
    .single()
  if (!data?.employee_id) {
    throw new Error('Kein Mitarbeiterprofil verknüpft. Zeiterfassung nur für Mitarbeiter verfügbar.')
  }
  return data as { employee_id: string; company_id: string }
}

async function getMyEmployeeId(): Promise<string> {
  const { employee_id } = await getMyProfile()
  return employee_id
}

export async function startTimer(note?: string): Promise<TimeRecord> {
  const { employee_id, company_id } = await getMyProfile()
  const now = new Date()
  const { data, error } = await supabase
    .from('time_records')
    .insert({
      employee_id,
      company_id,
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
    .update({ end_time: now.toTimeString().slice(0, 5), status: 'submitted' })
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
  const { start, end } = monthRange(year, month)
  const { data, error } = await supabase
    .from('time_records')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

/** Erster/letzter Kalendertag des Monats als ISO-Strings — '-31' wäre für Feb/Apr/… ein ungültiges Datum. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

/** Auswählbare Jahre für die Zeiterfassung: 2025 bis laufendes Jahr. */
export function selectableYears(): number[] {
  const current = new Date().getFullYear()
  const years: number[] = []
  for (let y = 2025; y <= current; y++) years.push(y)
  return years
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
