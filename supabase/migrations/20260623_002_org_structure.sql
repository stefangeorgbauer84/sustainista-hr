-- ============================================================
-- HR Platform — Migration 002: Organizational Structure
-- Departments, Locations, Cost Centers, KV, Holidays
-- ============================================================

create table departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies on delete cascade,
  name        text not null,
  parent_id   uuid references departments,
  manager_id  uuid,
  sort_order  int default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);
alter table departments enable row level security;
create policy "departments: company isolation"
  on departments for all using (company_id = get_my_company_id());

create table locations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies on delete cascade,
  name          text not null,
  address       jsonb default '{}'::jsonb,
  federal_state text not null default 'Wien',
  timezone      text default 'Europe/Vienna',
  is_active     boolean default true,
  created_at    timestamptz default now()
);
alter table locations enable row level security;
create policy "locations: company isolation"
  on locations for all using (company_id = get_my_company_id());

create table cost_centers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies on delete cascade,
  code        text not null,
  name        text not null,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  unique(company_id, code)
);
alter table cost_centers enable row level security;
create policy "cost_centers: company isolation"
  on cost_centers for all using (company_id = get_my_company_id());

-- AT-01, AT-02, PV-03
create table kollektivvertraege (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references companies on delete cascade,
  name            text not null,
  industry_code   text,
  valid_from      date not null,
  valid_to        date,
  kv_groups       jsonb not null default '[]'::jsonb,
  sonderzahlungen jsonb default '{}'::jsonb,
  version         int default 1,
  is_current      boolean default true,
  source_url      text,
  created_at      timestamptz default now()
);
alter table kollektivvertraege enable row level security;
create policy "kv: company or system"
  on kollektivvertraege for select
  using (company_id is null or company_id = get_my_company_id());
create policy "kv: hr manage"
  on kollektivvertraege for insert update delete
  using (company_id = get_my_company_id() and is_hr_or_above());

-- AT-07
create table public_holidays (
  id            uuid primary key default gen_random_uuid(),
  country       text default 'AT',
  federal_state text,
  holiday_date  date not null,
  name          text not null,
  is_mandatory  boolean default true,
  year          int not null
);
alter table public_holidays enable row level security;
create policy "holidays: all authenticated"
  on public_holidays for select using (auth.uid() is not null);
