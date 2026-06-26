-- ============================================================
-- HR Platform — Migration 001: Foundation
-- Enums, helper functions, companies, profiles, roles
-- ============================================================

-- ENUMS
create type user_role as enum (
  'super_admin', 'company_admin', 'hr_manager', 'hr_staff',
  'manager', 'payroll', 'employee', 'read_only'
);

create type employment_type as enum (
  'vollzeit', 'teilzeit', 'geringfuegig', 'lehrling',
  'freier_dienstnehmer', 'praktikant', 'werkvertrag'
);

create type absence_code as enum (
  'urlaub', 'krankenstand', 'pflegefreistellung', 'sonderurlaub',
  'zeitausgleich', 'dienstreise', 'homeoffice', 'bildungskarenz',
  'pflegekarenz', 'mutterschutz', 'elternteilzeit', 'unbezahlt',
  'berufsschule', 'praesenzdienst'
);

create type doc_access_level as enum (
  'all_staff', 'hr_only', 'manager_and_hr', 'payroll_and_hr', 'admin_only'
);

create type audit_action as enum (
  'INSERT', 'UPDATE', 'DELETE', 'SELECT_SENSITIVE', 'EXPORT',
  'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'DOWNLOAD'
);

-- ============================================================
-- COMPANIES (DS-10, IT-06 — Multi-Tenant Root)
-- ============================================================
create table companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  legal_name        text,
  uid_number        text,
  address           jsonb default '{}'::jsonb,
  brand_config      jsonb default '{}'::jsonb,
  settings          jsonb default '{}'::jsonb,
  payroll_system    text default 'manual',
  federal_state     text default 'Wien',
  subscription_tier text default 'standard',
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- PROFILES (IS-05, DS-02, DS-11)
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  company_id  uuid not null references companies on delete cascade,
  employee_id uuid,
  role        user_role not null default 'employee',
  is_active   boolean default true,
  last_login  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table user_role_scopes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles on delete cascade,
  company_id        uuid not null references companies on delete cascade,
  scope_departments uuid[] default null,
  scope_locations   uuid[] default null,
  extra_permissions jsonb default '{}'::jsonb,
  granted_by        uuid references profiles,
  valid_until       date,
  created_at        timestamptz default now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function get_my_company_id()
returns uuid language sql stable security definer as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function get_my_employee_id()
returns uuid language sql stable security definer as $$
  select employee_id from profiles where id = auth.uid()
$$;

create or replace function get_my_role()
returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function has_role(check_role user_role)
returns boolean language sql stable security definer as $$
  select exists(select 1 from profiles where id = auth.uid() and role = check_role)
$$;

create or replace function has_any_role(roles user_role[])
returns boolean language sql stable security definer as $$
  select exists(select 1 from profiles where id = auth.uid() and role = any(roles))
$$;

create or replace function is_hr_or_above()
returns boolean language sql stable security definer as $$
  select has_any_role('{hr_manager,hr_staff,company_admin,super_admin}'::user_role[])
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table companies enable row level security;
create policy "companies: own only"
  on companies for select
  using (id = get_my_company_id());
create policy "companies: admin update"
  on companies for update
  using (id = get_my_company_id() and has_any_role('{company_admin,super_admin}'::user_role[]));

alter table profiles enable row level security;
create policy "profiles: company isolation"
  on profiles for select
  using (company_id = get_my_company_id());
create policy "profiles: own insert"
  on profiles for insert
  with check (id = auth.uid());
create policy "profiles: admin manage"
  on profiles for update
  using (company_id = get_my_company_id() and has_any_role('{company_admin,hr_manager}'::user_role[]));

alter table user_role_scopes enable row level security;
create policy "scopes: company isolation"
  on user_role_scopes for all
  using (company_id = get_my_company_id() and is_hr_or_above());
