-- ============================================================
-- #8: employees self-register insert policy
-- Allows newly registered users to insert their own pending record
-- ============================================================
create policy "employees: self register"
  on employees for insert
  with check (
    auth.uid() = user_id
    and is_active = false
    and (custom_fields->>'status') = 'pending'
  );

-- ============================================================
-- #5: Impersonation audit log
-- ============================================================
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action        text not null,
  target_id     text,
  metadata      jsonb,
  created_at    timestamptz default now()
);

alter table audit_log enable row level security;

create policy "audit_log: hr reads own company"
  on audit_log for select
  using (company_id = get_my_company_id() and is_hr_or_above());

create policy "audit_log: system insert"
  on audit_log for insert
  with check (actor_user_id = auth.uid());

create index audit_log_company_idx on audit_log(company_id, created_at desc);
create index audit_log_actor_idx   on audit_log(actor_user_id, created_at desc);
