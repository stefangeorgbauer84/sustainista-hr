-- Migration 011: Performance Indexes + Security Fixes
-- Applied: 2026-06-27

CREATE INDEX IF NOT EXISTS idx_employees_company_id        ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_kv_id             ON employees(kv_id);
CREATE INDEX IF NOT EXISTS idx_employees_cost_center_id    ON employees(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id        ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_entry_date        ON employees(entry_date);
CREATE INDEX IF NOT EXISTS idx_employees_is_active         ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_last_name         ON employees(last_name);
CREATE INDEX IF NOT EXISTS idx_employees_company_active    ON employees(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id   ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id  ON profiles(employee_id);

CREATE INDEX IF NOT EXISTS idx_emp_history_employee_id ON employee_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_history_company_id  ON employee_history(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_history_changed_at  ON employee_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_absences_employee_id ON absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_company_id  ON absences(company_id);

CREATE INDEX IF NOT EXISTS idx_time_records_employee_id ON time_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_records_company_id  ON time_records(company_id);

CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id  ON documents(company_id);

CREATE INDEX IF NOT EXISTS idx_payroll_items_export_id  ON payroll_export_items(payroll_export_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_company_id ON payroll_export_items(company_id);

-- SECURITY FIX: self-register policy had no company_id guard —
-- any authenticated user could INSERT an employee into any company
DROP POLICY IF EXISTS "employees: self register" ON employees;

-- CONSISTENCY: 4 tables used profiles subquery instead of get_my_company_id()
DROP POLICY IF EXISTS "admin_manage_contracts" ON contracts;
CREATE POLICY "contracts: hr or admin"
  ON contracts FOR ALL
  USING (company_id = get_my_company_id() AND has_any_role(ARRAY['company_admin','hr_manager','super_admin']::user_role[]));

DROP POLICY IF EXISTS "company_admin_manage_employee_locations" ON employee_locations;
CREATE POLICY "employee_locations: admin"
  ON employee_locations FOR ALL
  USING (company_id = get_my_company_id() AND has_any_role(ARRAY['company_admin','hr_manager','super_admin']::user_role[]));

DROP POLICY IF EXISTS "company_admin_manage_change_requests" ON schedule_change_requests;
CREATE POLICY "schedule_change_requests: admin"
  ON schedule_change_requests FOR ALL
  USING (company_id = get_my_company_id() AND has_any_role(ARRAY['company_admin','hr_manager','super_admin']::user_role[]));

DROP POLICY IF EXISTS "company_admin_manage_shifts" ON shift_schedules;
CREATE POLICY "shift_schedules: admin"
  ON shift_schedules FOR ALL
  USING (company_id = get_my_company_id() AND has_any_role(ARRAY['company_admin','hr_manager','super_admin']::user_role[]));
