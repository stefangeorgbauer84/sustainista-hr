-- HR Platform — Migration 008: Onboarding & Recruiting (ON-01–ON-08, RE-01–RE-06)

create table onboarding_templates (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies on delete cascade,
  name         text not null,
  description  text,
  role_filter  text[],
  is_active    boolean default true,
  created_at   timestamptz default now()
);
alter table onboarding_templates enable row level security;
create policy "onboarding_templates: hr" on onboarding_templates for all using (company_id = get_my_company_id() and is_hr_or_above());

create table onboarding_template_tasks (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references onboarding_templates on delete cascade,
  company_id       uuid not null,
  title            text not null,
  description      text,
  due_days_offset  int default 0,
  owner_role       user_role default 'hr_staff',
  category         text default 'general',
  is_required      boolean default true,
  sort_order       int default 0
);
alter table onboarding_template_tasks enable row level security;
create policy "template_tasks: hr" on onboarding_template_tasks for all using (company_id = get_my_company_id() and is_hr_or_above());

create table onboarding_instances (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  employee_id     uuid not null references employees on delete cascade,
  template_id     uuid references onboarding_templates,
  status          text default 'pending',
  start_date      date not null,
  target_end_date date,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);
alter table onboarding_instances enable row level security;
create policy "onboarding_instances: hr or own" on onboarding_instances for all using (company_id = get_my_company_id() and (is_hr_or_above() or employee_id = get_my_employee_id()));

create table onboarding_tasks (
  id              uuid primary key default gen_random_uuid(),
  instance_id     uuid not null references onboarding_instances on delete cascade,
  company_id      uuid not null,
  template_task_id uuid references onboarding_template_tasks,
  title           text not null,
  description     text,
  due_date        date,
  assigned_to     uuid references profiles,
  status          text default 'pending',
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz default now()
);
alter table onboarding_tasks enable row level security;
create policy "onboarding_tasks: hr or assigned" on onboarding_tasks for all using (company_id = get_my_company_id() and (is_hr_or_above() or assigned_to = auth.uid()));

-- Recruiting
create table job_postings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies on delete cascade,
  department_id     uuid references departments,
  location_id       uuid references locations,
  title             text not null,
  description       text,
  requirements      text,
  employment_type   employment_type default 'vollzeit',
  salary_range_min  numeric(10,2),
  salary_range_max  numeric(10,2),
  kv_id             uuid references kollektivvertraege,
  kv_group          text,
  kv_level          int,
  status            text default 'draft',
  published_at      timestamptz,
  closes_at         date,
  created_by        uuid references profiles,
  created_at        timestamptz default now()
);
alter table job_postings enable row level security;
create policy "job_postings: hr manage" on job_postings for all using (company_id = get_my_company_id() and is_hr_or_above());
create policy "job_postings: public read" on job_postings for select using (status = 'published');

create table applications (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  job_posting_id  uuid references job_postings,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  cv_storage_path text,
  cover_letter    text,
  status          text default 'received',
  source          text,
  applied_at      timestamptz default now(),
  converted_to_employee_id uuid references employees,
  created_at      timestamptz default now()
);
alter table applications enable row level security;
create policy "applications: hr" on applications for all using (company_id = get_my_company_id() and is_hr_or_above());

create table application_interviews (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications on delete cascade,
  company_id      uuid not null,
  interviewer_id  uuid references employees,
  interview_type  text default 'phone',
  scheduled_at    timestamptz not null,
  duration_min    int default 60,
  location        text,
  notes           text,
  rating          int check (rating between 1 and 5),
  outcome         text,
  created_at      timestamptz default now()
);
alter table application_interviews enable row level security;
create policy "interviews: hr or interviewer" on application_interviews for all using (company_id = get_my_company_id() and (is_hr_or_above() or interviewer_id = get_my_employee_id()));
