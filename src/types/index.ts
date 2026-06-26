import type { User, Session } from '@supabase/supabase-js'

export type { User, Session }

export type UserRole = 'super_admin' | 'company_admin' | 'hr_manager' | 'hr_staff' | 'manager' | 'payroll' | 'employee' | 'read_only'
export type EmploymentType = 'vollzeit' | 'teilzeit' | 'geringfuegig' | 'lehrling' | 'freier_dienstnehmer' | 'praktikant' | 'werkvertrag'
export type AbsenceCode = 'urlaub' | 'krankenstand' | 'pflegefreistellung' | 'sonderurlaub' | 'zeitausgleich' | 'dienstreise' | 'homeoffice' | 'bildungskarenz' | 'pflegekarenz' | 'mutterschutz' | 'elternteilzeit' | 'unbezahlt' | 'berufsschule' | 'praesenzdienst'

export interface Profile {
  id: string
  company_id: string
  employee_id: string | null
  role: UserRole
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  company_id: string
  employee_number: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  gender: string | null
  nationality: string | null
  svnr: string | null
  address: Record<string, unknown>
  contact_email: string | null
  contact_phone: string | null
  bank_iban: string | null
  bank_bic: string | null
  bank_name: string | null
  tax_id: string | null
  tax_class: string | null
  employment_type: EmploymentType
  entry_date: string
  exit_date: string | null
  probation_end_date: string | null
  contract_type: string
  contract_end_date: string | null
  hours_per_week: number
  employment_percentage: number
  department_id: string | null
  location_id: string | null
  manager_id: string | null
  cost_center_id: string | null
  kv_id: string | null
  kv_group: string | null
  kv_level: number | null
  next_advancement_date: string | null
  custom_fields: Record<string, unknown>
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface TimeRecord {
  id: string
  company_id: string
  employee_id: string
  work_date: string
  start_time: string
  end_time: string | null
  break_minutes: number
  net_minutes: number | null
  location_type: string
  created_via: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_note: string | null
  warnings: unknown[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Absence {
  id: string
  company_id: string
  employee_id: string
  absence_type_id: string
  start_date: string
  end_date: string
  half_day_start: boolean
  half_day_end: boolean
  working_days: number | null
  deputy_id: string | null
  deputy_note: string | null
  reason: string | null
  doctor_note: string | null
  status: 'requested' | 'approved' | 'rejected' | 'cancelled'
  requested_by: string | null
  requested_at: string
  approved_by: string | null
  approved_at: string | null
  rejection_note: string | null
  payroll_exported_at: string | null
  created_at: string
  updated_at: string
}

export interface AbsenceType {
  id: string
  company_id: string
  code: AbsenceCode
  name: string
  name_en: string | null
  requires_approval: boolean
  counts_as_leave: boolean
  is_paid: boolean
  requires_doc: boolean
  color_hex: string
  max_days_per_year: number | null
  is_active: boolean
}

export interface LeaveBalance {
  id: string
  company_id: string
  employee_id: string
  year: number
  entitlement_days: number
  carry_over_days: number
  carry_over_expiry: string | null
  taken_days: number
  approved_pending_days: number
  updated_at: string
}

export interface Document {
  id: string
  company_id: string
  employee_id: string | null
  category_id: string | null
  title: string
  description: string | null
  tags: string[]
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  version: number
  is_current_version: boolean
  expires_at: string | null
  visible_to_employee: boolean
  uploaded_by: string | null
  uploaded_at: string
  deleted_at: string | null
}

export interface WorkStats {
  totalHoursThisMonth: number
  overtimeHours: number
  vacationDaysLeft: number
  sickDaysThisYear: number
  currentlyRunning: boolean
}
