-- HR Platform — Migration 006: Personalakte (PA-01–PA-08)

create table document_categories (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies on delete cascade,
  name               text not null,
  retention_months   int,
  access_level       doc_access_level default 'hr_only',
  requires_signature boolean default false,
  is_system          boolean default false,
  sort_order         int default 0
);
alter table document_categories enable row level security;
create policy "doc_categories: company" on document_categories for all using (company_id = get_my_company_id());

create table documents (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies on delete cascade,
  employee_id         uuid references employees on delete cascade,
  category_id         uuid references document_categories,
  title               text not null,
  description         text,
  tags                text[] default '{}',
  storage_path        text not null,
  file_name           text not null,
  file_size           bigint,
  mime_type           text,
  version             int default 1,
  previous_version_id uuid references documents,
  is_current_version  boolean default true,
  expires_at          date,
  expiry_notice_days  int default 30,
  signed_at           timestamptz,
  signed_by           uuid references profiles,
  signature_method    text,
  visible_to_employee boolean default false,
  uploaded_by         uuid references profiles,
  uploaded_at         timestamptz default now(),
  deleted_at          timestamptz,
  deleted_by          uuid references profiles
);
alter table documents enable row level security;
create policy "documents: hr" on documents for all using (company_id = get_my_company_id() and is_hr_or_above());
create policy "documents: own visible" on documents for select using (company_id = get_my_company_id() and employee_id = get_my_employee_id() and visible_to_employee = true and deleted_at is null);
create policy "documents: manager team" on documents for select using (
  company_id = get_my_company_id() and has_role('manager') and
  employee_id in (select id from employees where manager_id = get_my_employee_id()) and
  (select access_level from document_categories where id = category_id) != 'hr_only'
);
