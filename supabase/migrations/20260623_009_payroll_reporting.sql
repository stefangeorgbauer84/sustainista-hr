-- HR Platform — Migration 009: Payroll Exports, Reporting, Settings (PV-01–PV-09, RP-01–RP-06, FS-01–FS-08)

create table payroll_exports (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies on delete cascade,
  period_year         int not null,
  period_month        int not null,
  export_format       text default 'elda',
  status              text default 'draft',
  created_by          uuid references profiles,
  created_at          timestamptz default now(),
  submitted_at        timestamptz,
  file_storage_path   text,
  total_gross_salary  numeric(12,2),
  total_employees     int,
  errors              jsonb,
  notes               text,
  unique(company_id, period_year, period_month, export_format)
);
alter table payroll_exports enable row level security;
create policy "payroll_exports: payroll or hr" on payroll_exports for all using (company_id = get_my_company_id() and has_any_role('{payroll,hr_manager,company_admin,super_admin}'::user_role[]));

create table payroll_export_items (
  id                  uuid primary key default gen_random_uuid(),
  payroll_export_id   uuid not null references payroll_exports on delete cascade,
  company_id          uuid not null,
  employee_id         uuid not null references employees,
  gross_salary        numeric(10,2),
  net_salary          numeric(10,2),
  kv_salary           numeric(10,2),
  overtime_pay        numeric(10,2),
  bonus               numeric(10,2),
  sonderzahlung       numeric(10,2),
  sv_employee         numeric(10,2),
  sv_employer         numeric(10,2),
  lohnsteuer          numeric(10,2),
  vacation_days_taken numeric(5,1),
  sick_days           int,
  absences_json       jsonb,
  warnings            jsonb,
  created_at          timestamptz default now()
);
alter table payroll_export_items enable row level security;
create policy "payroll_items: payroll or hr" on payroll_export_items for all using (company_id = get_my_company_id() and has_any_role('{payroll,hr_manager,company_admin,super_admin}'::user_role[]));

create table report_configs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  name            text not null,
  report_type     text not null,
  config          jsonb not null default '{}',
  schedule_cron   text,
  last_run_at     timestamptz,
  created_by      uuid references profiles,
  is_active       boolean default true,
  created_at      timestamptz default now()
);
alter table report_configs enable row level security;
create policy "report_configs: hr" on report_configs for all using (company_id = get_my_company_id() and is_hr_or_above());

create table company_settings (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies on delete cascade unique,
  fiscal_year_start_month int default 1,
  leave_year_type         text default 'calendar',
  leave_carry_over_months int default 3,
  max_carry_over_days     numeric(5,1) default 5,
  default_vacation_days   int default 25,
  overtime_threshold_week numeric(5,2) default 40,
  elda_employer_number    text,
  bav_provider            text,
  custom_fields_schema    jsonb default '{}',
  feature_flags           jsonb default '{}',
  updated_at              timestamptz default now()
);
alter table company_settings enable row level security;
create policy "settings: hr or admin" on company_settings for all using (company_id = get_my_company_id() and has_any_role('{company_admin,hr_manager,super_admin}'::user_role[]));
create policy "settings: read" on company_settings for select using (company_id = get_my_company_id());

-- DS-06 DSGVO Auskunft/Berichtigung
create table data_change_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  employee_id     uuid not null references employees on delete cascade,
  request_type    text not null,
  description     text not null,
  status          text default 'pending',
  requested_at    timestamptz default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references profiles,
  resolution_note text
);
alter table data_change_requests enable row level security;
create policy "dcr: hr or own" on data_change_requests for all using (company_id = get_my_company_id() and (is_hr_or_above() or employee_id = get_my_employee_id()));
