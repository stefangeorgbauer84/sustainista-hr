-- HR Platform — Migration 005: Absences & Leave Balances (AB-01–AB-08)

create table absence_types (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies on delete cascade,
  code              absence_code not null,
  name              text not null,
  name_en           text,
  requires_approval boolean default true,
  counts_as_leave   boolean default false,
  is_paid           boolean default true,
  requires_doc      boolean default false,
  color_hex         text default '#3B82F6',
  max_days_per_year int,
  is_active         boolean default true,
  unique(company_id, code)
);
alter table absence_types enable row level security;
create policy "absence_types: company" on absence_types for all using (company_id = get_my_company_id());

create table absences (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies on delete cascade,
  employee_id         uuid not null references employees on delete cascade,
  absence_type_id     uuid not null references absence_types,
  start_date          date not null,
  end_date            date not null,
  half_day_start      boolean default false,
  half_day_end        boolean default false,
  working_days        numeric(5,1),
  deputy_id           uuid references employees,
  deputy_note         text,
  reason              text,
  doctor_note         text,
  status              text default 'requested',
  requested_by        uuid references profiles,
  requested_at        timestamptz default now(),
  approved_by         uuid references profiles,
  approved_at         timestamptz,
  rejection_note      text,
  payroll_exported_at timestamptz,
  payroll_export_id   uuid,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table absences enable row level security;
create policy "absences: hr" on absences for all using (company_id = get_my_company_id() and is_hr_or_above());
create policy "absences: manager select" on absences for select using (company_id = get_my_company_id() and has_role('manager') and employee_id in (select id from employees where manager_id = get_my_employee_id()));
create policy "absences: manager update" on absences for update using (company_id = get_my_company_id() and has_role('manager') and employee_id in (select id from employees where manager_id = get_my_employee_id()));
create policy "absences: own" on absences for all using (company_id = get_my_company_id() and employee_id = get_my_employee_id());

create table leave_balances (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies on delete cascade,
  employee_id           uuid not null references employees on delete cascade,
  year                  int not null,
  entitlement_days      numeric(5,1) not null,
  carry_over_days       numeric(5,1) default 0,
  carry_over_expiry     date,
  taken_days            numeric(5,1) default 0,
  approved_pending_days numeric(5,1) default 0,
  updated_at            timestamptz default now(),
  unique(company_id, employee_id, year)
);
alter table leave_balances enable row level security;
create policy "leave_balances: hr or own" on leave_balances for all using (company_id = get_my_company_id() and (is_hr_or_above() or employee_id = get_my_employee_id()));
