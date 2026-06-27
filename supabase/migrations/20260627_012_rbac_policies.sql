-- Migration 012: RBAC — Missing role policies
-- Applied: 2026-06-27
-- Adds SELECT access for payroll + read_only roles on employees / employee_history.
-- Column-level masking (brutto, Pfändung) is enforced at application layer.

-- payroll: needs to read all active employees for export
CREATE POLICY "employees: payroll read"
  ON employees FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND has_role('payroll')
  );

-- read_only: can browse employee list (sensitive cols masked in UI)
CREATE POLICY "employees: read_only browse"
  ON employees FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND has_role('read_only')
  );

-- payroll: needs history for audit trail during export
CREATE POLICY "employee_history: payroll read"
  ON employee_history FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND has_role('payroll')
  );

-- hr_staff: already covered by is_hr_or_above() ALL policy — no additional policy needed.
