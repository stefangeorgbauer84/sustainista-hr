-- ============================================================
-- HR Platform — Migration 003: Employees & Work Schedules
-- PS-01–PS-08, PV-01–PV-09, AT-03–AT-09
-- ============================================================

create table employees (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies on delete cascade,
  employee_number       text,
  first_name            text not null,
  last_name             text not null,
  birth_date            date,
  gender                text,
  nationality           text,
  svnr                  text,
  address               jsonb default '{}'::jsonb,
  contact_email         text,
  contact_phone         text,
  bank_iban             text,
  bank_bic              text,
  bank_name             text,
  tax_id                text,
  tax_class             text,
  employment_type       employment_type not null default 'vollzeit',
  entry_date            date not null,
  exit_date             date,
  probation_end_date    date,
  contract_type         text default 'unbefristet',
  contract_end_date     date,
  hours_per_week        numeric(5,2) default 38.5,
  employment_percentage numeric(5,2) default 100,
  department_id         uuid references departments,
  location_id           uuid references locations,
  manager_id            uuid references employees,
  cost_center_id        uuid references cost_centers,
  kv_id                 uuid references kollektivvertraege,
  kv_group              text,
  kv_level              int,
  next_advancement_date date,
  custom_fields         jsonb default '{}'::jsonb,
  is_active             boolean default true,
  deleted_at            timestamptz,
  deleted_by            uuid,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique(company_id, employee_number)
);

-- PS-05: Historisierung
create table employee_history (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees on delete cascade,
  company_id   uuid not null,
  changed_by   uuid,
  changed_at   timestamptz default now(),
  change_type  text not null,
  old_values   jsonb,
  new_values   jsonb,
  change_note  text
);

-- AT-09: Arbeitsbewilligungen
create table work_permits (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies on delete cascade,
  employee_id       uuid not null references employees on delete cascade,
  permit_type       text not null,
  permit_number     text,
  valid_from        date,
  valid_to          date not null,
  issuing_authority text,
  status            text default 'active',
  document_id       uuid,
  notes             text,
  created_at        timestamptz default now()
);

-- AZ-04: Arbeitszeitmodell-Templates
create table work_schedule_templates (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies on delete cascade,
  name                 text not null,
  schedule_type        text not null,
  hours_per_week       numeric(5,2) default 38.5,
  daily_hours          numeric(5,2) default 7.7,
  core_time_start      time,
  core_time_end        time,
  flex_start_earliest  time,
  flex_end_latest      time,
  max_daily_hours      numeric(4,2) default 10,
  min_break_minutes    int default 30,
  min_rest_hours       int default 11,
  durchrechnung_weeks  int,
  is_active            boolean default true,
  created_at           timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table employees enable row level security;
create policy "employees: hr sees all"
  on employees for all
  using (company_id = get_my_company_id() and is_hr_or_above());
create policy "employees: manager sees team"
  on employees for select
  using (
    company_id = get_my_company_id() and
    has_role('manager') and
    manager_id = get_my_employee_id()
  );
create policy "employees: own record"
  on employees for select
  using (company_id = get_my_company_id() and id = get_my_employee_id());

alter table employee_history enable row level security;
create policy "employee_history: hr only"
  on employee_history for all
  using (company_id = get_my_company_id() and is_hr_or_above());

alter table work_permits enable row level security;
create policy "work_permits: hr or own"
  on work_permits for select
  using (
    company_id = get_my_company_id() and
    (is_hr_or_above() or employee_id = get_my_employee_id())
  );
create policy "work_permits: hr insert"
  on work_permits for insert
  with check (company_id = get_my_company_id() and is_hr_or_above());
create policy "work_permits: hr update"
  on work_permits for update
  using (company_id = get_my_company_id() and is_hr_or_above());
create policy "work_permits: hr delete"
  on work_permits for delete
  using (company_id = get_my_company_id() and is_hr_or_above());

alter table work_schedule_templates enable row level security;
create policy "schedules: company"
  on work_schedule_templates for all using (company_id = get_my_company_id());

-- ============================================================
-- TRIGGER: PS-05 auto-historisierung bei Update
-- ============================================================
create or replace function employee_history_trigger()
returns trigger language plpgsql security definer as $$
begin
  if old is distinct from new then
    insert into employee_history(employee_id, company_id, changed_by, old_values, new_values, change_type)
    values (new.id, new.company_id, auth.uid(), to_jsonb(old), to_jsonb(new), 'update');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger employees_history
  before update on employees
  for each row execute function employee_history_trigger();
