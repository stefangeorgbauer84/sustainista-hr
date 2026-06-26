-- HR Platform — Migration 007: Compliance, Audit, DSGVO (DS-01–DS-11, DP-01–DP-08, RP-01–RP-06)

create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies on delete set null,
  user_id      uuid references auth.users on delete set null,
  action       audit_action not null,
  table_name   text,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_address   inet,
  user_agent   text,
  metadata     jsonb,
  created_at   timestamptz default now()
);
alter table audit_logs enable row level security;
create policy "audit_logs: hr read only" on audit_logs for select using (company_id = get_my_company_id() and is_hr_or_above());

-- DS-07 Löschfristen
create table deletion_schedules (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  table_name      text not null,
  record_id       uuid not null,
  employee_id     uuid references employees,
  legal_basis     text not null,
  retention_until date not null,
  deletion_type   text default 'anonymize',
  requested_at    timestamptz default now(),
  executed_at     timestamptz,
  status          text default 'scheduled'
);
alter table deletion_schedules enable row level security;
create policy "deletion: hr only" on deletion_schedules for all using (company_id = get_my_company_id() and is_hr_or_above());

-- DS-04 Einwilligungen
create table consents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies on delete cascade,
  employee_id     uuid not null references employees on delete cascade,
  consent_type    text not null,
  consent_text    text,
  version         text not null,
  granted         boolean not null,
  granted_at      timestamptz default now(),
  revoked_at      timestamptz,
  ip_address      inet,
  channel         text default 'app'
);
alter table consents enable row level security;
create policy "consents: hr or own" on consents for all using (company_id = get_my_company_id() and (is_hr_or_above() or employee_id = get_my_employee_id()));

-- SS-01–SS-05 Benachrichtigungen
create table notification_rules (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies on delete cascade,
  event_type         text not null,
  target_roles       user_role[] default '{}',
  advance_days       int default 0,
  channels           text[] default '{app}',
  message_template   text,
  is_active          boolean default true,
  created_at         timestamptz default now()
);
alter table notification_rules enable row level security;
create policy "notif_rules: hr" on notification_rules for all using (company_id = get_my_company_id() and is_hr_or_above());

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  action_url   text,
  data         jsonb,
  read_at      timestamptz,
  created_at   timestamptz default now()
);
alter table notifications enable row level security;
create policy "notifications: own" on notifications for all using (company_id = get_my_company_id() and user_id = auth.uid());
create policy "notifications: hr send" on notifications for insert with check (company_id = get_my_company_id() and is_hr_or_above());

-- Universal audit trigger
create or replace function universal_audit_trigger() returns trigger language plpgsql security definer as $$
begin
  insert into audit_logs(company_id, user_id, action, table_name, record_id, old_data, new_data)
  values (
    case when TG_OP = 'DELETE' then (to_jsonb(old)->>'company_id')::uuid
         else (to_jsonb(new)->>'company_id')::uuid end,
    auth.uid(),
    TG_OP::audit_action,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then (to_jsonb(old)->>'id')::uuid
         else (to_jsonb(new)->>'id')::uuid end,
    case when TG_OP != 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP != 'DELETE' then to_jsonb(new) else null end
  );
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger employees_audit after insert or update or delete on employees for each row execute function universal_audit_trigger();
create trigger absences_audit after insert or update or delete on absences for each row execute function universal_audit_trigger();
create trigger documents_audit after insert or update or delete on documents for each row execute function universal_audit_trigger();
