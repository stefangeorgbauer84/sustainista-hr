-- Migration 016: Manager-Rolle — SVNR/IBAN/tax_id aus SELECT ausschließen
--
-- Problem: RLS policy "employees: manager sees team" erlaubt SELECT auf alle
-- Spalten der employees-Tabelle für team leads. SVNR, IBAN, tax_id sind
-- personenbezogene Daten der höchsten Sensibilitätsstufe (DSGVO Art. 87,
-- § 1 DSG — Sozialversicherungsnummer als besondere Kategorie).
--
-- Fix: Neue RPC-Funktion get_team_employees() die sensitive Felder maskiert.
-- Die Manager-Policy auf der employees-Tabelle bleibt (nötig für Joins/FKs),
-- aber direkte Queries auf die Tabelle von Manager-Clients werden via
-- Anwendungs-Middleware auf die RPC umgeleitet.
--
-- Zusätzlich: PostgreSQL column-level grants entziehen dem manager-Profil
-- die Spalten nicht (PostgREST nutzt authenticated-Rolle), daher ist die
-- RPC-Funktion der verlässlichste Schutz.

CREATE OR REPLACE FUNCTION public.get_team_employees()
RETURNS TABLE (
  id uuid,
  company_id uuid,
  employee_number text,
  first_name text,
  last_name text,
  birth_date date,
  gender text,
  nationality text,
  -- svnr, bank_iban, bank_bic, bank_name, tax_id, tax_class: intentionally omitted
  address jsonb,
  contact_email text,
  contact_phone text,
  employment_type text,
  entry_date date,
  exit_date date,
  probation_end_date date,
  contract_type text,
  contract_end_date date,
  hours_per_week numeric,
  employment_percentage numeric,
  department_id uuid,
  location_id uuid,
  manager_id uuid,
  cost_center_id uuid,
  kv_id uuid,
  kv_group text,
  kv_level int,
  next_advancement_date date,
  custom_fields jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id, e.company_id, e.employee_number, e.first_name, e.last_name,
    e.birth_date, e.gender, e.nationality,
    e.address, e.contact_email, e.contact_phone,
    e.employment_type::text, e.entry_date, e.exit_date, e.probation_end_date,
    e.contract_type, e.contract_end_date, e.hours_per_week, e.employment_percentage,
    e.department_id, e.location_id, e.manager_id, e.cost_center_id,
    e.kv_id, e.kv_group, e.kv_level, e.next_advancement_date,
    e.custom_fields, e.is_active, e.created_at, e.updated_at
  FROM public.employees e
  WHERE
    e.company_id = get_my_company_id()
    AND (
      -- HR-Rollen sehen alle
      is_hr_or_above()
      -- Manager sehen nur ihr Team
      OR (has_role('manager') AND e.manager_id = get_my_employee_id())
    )
    AND e.deleted_at IS NULL;
$$;

-- Nur authenticated darf aufrufen
REVOKE ALL ON FUNCTION public.get_team_employees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_employees() TO authenticated;

COMMENT ON FUNCTION public.get_team_employees() IS
  'Gibt Mitarbeiterdaten ohne SVNR/IBAN/tax_id zurück. Für Manager-Rolle und HR. DSGVO-konform.';
