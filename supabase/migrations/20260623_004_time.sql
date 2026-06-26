-- HR Platform — Migration 004: Time Recording & Shift Plans (AZ-01–AZ-10, DP-01–DP-08)

create table time_records (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  employee_id     uuid not null references employees on delete cascade,
  work_date       date not null,
  start_time      time not null,
  end_time        time,
  break_minutes   int default 0,
  net_minutes     int generated always as (
    case when end_time is not null
      then extract(epoch from (end_time - start_time))::int / 60 - break_minutes
      else null end
  ) stored,
  location_type   text default 'office',
  location_note   text,
  created_via     text default 'manual',
  status          text default 'draft',
  submitted_at    timestamptz,
  approved_by     uuid references profiles,
  approved_at     timestamptz,
  rejection_note  text,
  warnings        jsonb,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table time_record_corrections (
  id               uuid primary key default gen_random_uuid(),
  time_record_id   uuid not null references time_records on delete cascade,
  company_id       uuid not null,
  corrected_by     uuid not null references profiles,
  corrected_at     timestamptz default now(),
  old_values       jsonb not null,
  new_values       jsonb not null,
  reason           text not null
);

create table time_balances (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies on delete cascade,
  employee_id       uuid not null references employees on delete cascade,
  period_year       int not null,
  period_month      int not null,
  planned_minutes   int default 0,
  actual_minutes    int default 0,
  overtime_minutes  int default 0,
  comp_time_balance int default 0,
  carried_forward   int default 0,
  updated_at        timestamptz default now(),
  unique(company_id, employee_id, period_year, period_month)
);

create table shift_plans (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies on delete cascade,
  location_id    uuid references locations,
  department_id  uuid references departments,
  period_start   date not null,
  period_end     date not null,
  status         text default 'draft',
  published_at   timestamptz,
  published_by   uuid references profiles,
  created_at     timestamptz default now()
);

create table shift_plan_entries (
  id             uuid primary key default gen_random_uuid(),
  shift_plan_id  uuid not null references shift_plans on delete cascade,
  company_id     uuid not null,
  employee_id    uuid not null references employees on delete cascade,
  entry_date     date not null,
  start_time     time not null,
  end_time       time not null,
  break_minutes  int default 30,
  notes          text,
  warnings       jsonb,
  created_at     timestamptz default now()
);

alter table time_records enable row level security;
create policy "time_records: hr" on time_records for all using (company_id = get_my_company_id() and is_hr_or_above());
create policy "time_records: manager" on time_records for select using (company_id = get_my_company_id() and has_role('manager') and employee_id in (select id from employees where manager_id = get_my_employee_id()));
create policy "time_records: own" on time_records for all using (company_id = get_my_company_id() and employee_id = get_my_employee_id());
alter table time_record_corrections enable row level security;
create policy "corrections: hr or own" on time_record_corrections for select using (company_id = get_my_company_id() and (is_hr_or_above() or corrected_by = auth.uid()));
alter table time_balances enable row level security;
create policy "time_balances: hr or own" on time_balances for all using (company_id = get_my_company_id() and (is_hr_or_above() or employee_id = get_my_employee_id()));
alter table shift_plans enable row level security;
create policy "shift_plans: company" on shift_plans for all using (company_id = get_my_company_id());
alter table shift_plan_entries enable row level security;
create policy "shift_entries: company" on shift_plan_entries for all using (company_id = get_my_company_id());

create or replace function check_time_warnings() returns trigger language plpgsql as $$
declare max_h numeric; v_warnings jsonb := '[]'::jsonb;
begin
  select coalesce(wst.max_daily_hours, 10) into max_h from employees e
  left join work_schedule_templates wst on wst.company_id = e.company_id
  where e.id = new.employee_id limit 1;
  if new.end_time is not null then
    if (extract(epoch from (new.end_time - new.start_time)) / 3600 - new.break_minutes::numeric/60) > max_h then
      v_warnings := v_warnings || jsonb_build_object('type', 'max_daily_exceeded', 'limit_hours', max_h);
    end if;
    if new.break_minutes < 30 and (extract(epoch from (new.end_time - new.start_time)) / 60) > 360 then
      v_warnings := v_warnings || '{"type":"break_too_short"}'::jsonb;
    end if;
  end if;
  new.warnings := case when jsonb_array_length(v_warnings) > 0 then v_warnings else null end;
  new.updated_at := now();
  return new;
end;
$$;
create trigger time_record_warnings before insert or update on time_records for each row execute function check_time_warnings();
