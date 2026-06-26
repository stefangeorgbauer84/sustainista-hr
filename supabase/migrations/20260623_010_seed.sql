-- HR Platform — Migration 010: Seed Data (AT public holidays, absence types, doc categories)

-- AT public holidays 2026 + 2027 (AT-07)
insert into public_holidays (country, federal_state, holiday_date, name, is_mandatory, year) values
('AT', null, '2026-01-01', 'Neujahr', true, 2026),
('AT', null, '2026-01-06', 'Heilige Drei Könige', true, 2026),
('AT', null, '2026-04-06', 'Ostermontag', true, 2026),
('AT', null, '2026-05-01', 'Staatsfeiertag', true, 2026),
('AT', null, '2026-05-14', 'Christi Himmelfahrt', true, 2026),
('AT', null, '2026-05-25', 'Pfingstmontag', true, 2026),
('AT', null, '2026-06-04', 'Fronleichnam', true, 2026),
('AT', null, '2026-08-15', 'Mariä Himmelfahrt', true, 2026),
('AT', null, '2026-10-26', 'Nationalfeiertag', true, 2026),
('AT', null, '2026-11-01', 'Allerheiligen', true, 2026),
('AT', null, '2026-12-08', 'Mariä Empfängnis', true, 2026),
('AT', null, '2026-12-25', 'Weihnachten', true, 2026),
('AT', null, '2026-12-26', 'Stefanitag', true, 2026),
('AT', null, '2027-01-01', 'Neujahr', true, 2027),
('AT', null, '2027-01-06', 'Heilige Drei Könige', true, 2027),
('AT', null, '2027-03-29', 'Ostermontag', true, 2027),
('AT', null, '2027-05-01', 'Staatsfeiertag', true, 2027),
('AT', null, '2027-05-06', 'Christi Himmelfahrt', true, 2027),
('AT', null, '2027-05-17', 'Pfingstmontag', true, 2027),
('AT', null, '2027-05-27', 'Fronleichnam', true, 2027),
('AT', null, '2027-08-15', 'Mariä Himmelfahrt', true, 2027),
('AT', null, '2027-10-26', 'Nationalfeiertag', true, 2027),
('AT', null, '2027-11-01', 'Allerheiligen', true, 2027),
('AT', null, '2027-12-08', 'Mariä Empfängnis', true, 2027),
('AT', null, '2027-12-25', 'Weihnachten', true, 2027),
('AT', null, '2027-12-26', 'Stefanitag', true, 2027);

-- Burgenland extra: Martinstag (AT-07 Bundesland-spezifisch)
insert into public_holidays (country, federal_state, holiday_date, name, is_mandatory, year) values
('AT', 'Burgenland', '2026-11-11', 'Martinstag', true, 2026),
('AT', 'Burgenland', '2027-11-11', 'Martinstag', true, 2027);

-- Default document categories (system templates — company_id null = shared)
-- (company-specific ones created per tenant during setup wizard)
-- These are examples to copy; actual insert needs a real company_id so we leave for app-level seed

-- Helper: function to create default absence types for a new company
create or replace function create_default_absence_types(p_company_id uuid) returns void language plpgsql as $$
begin
  insert into absence_types (company_id, code, name, name_en, requires_approval, counts_as_leave, is_paid, requires_doc, color_hex) values
  (p_company_id, 'urlaub', 'Urlaub', 'Annual Leave', true, true, true, false, '#3B82F6'),
  (p_company_id, 'krankenstand', 'Krankenstand', 'Sick Leave', false, false, true, true, '#EF4444'),
  (p_company_id, 'pflegefreistellung', 'Pflegefreistellung', 'Carer Leave', false, false, true, false, '#F59E0B'),
  (p_company_id, 'sonderurlaub', 'Sonderurlaub', 'Special Leave', true, false, true, false, '#8B5CF6'),
  (p_company_id, 'zeitausgleich', 'Zeitausgleich', 'Time Off in Lieu', true, false, true, false, '#10B981'),
  (p_company_id, 'homeoffice', 'Homeoffice', 'Remote Work', false, false, true, false, '#6B7280'),
  (p_company_id, 'dienstreise', 'Dienstreise', 'Business Travel', false, false, true, false, '#0EA5E9'),
  (p_company_id, 'bildungskarenz', 'Bildungskarenz', 'Educational Leave', true, false, false, true, '#F97316'),
  (p_company_id, 'pflegekarenz', 'Pflegekarenz', 'Care Leave', true, false, false, true, '#EC4899'),
  (p_company_id, 'mutterschutz', 'Mutterschutz', 'Maternity Protection', false, false, true, true, '#F43F5E'),
  (p_company_id, 'elternteilzeit', 'Elternteilzeit', 'Parental Part-Time', true, false, true, false, '#A855F7'),
  (p_company_id, 'unbezahlt', 'Unbezahlter Urlaub', 'Unpaid Leave', true, false, false, true, '#9CA3AF'),
  (p_company_id, 'berufsschule', 'Berufsschule', 'Vocational School', false, false, true, false, '#14B8A6'),
  (p_company_id, 'praesenzdienst', 'Präsenz-/Zivildienst', 'Military/Civil Service', false, false, false, true, '#64748B')
  on conflict (company_id, code) do nothing;
end;
$$;

-- Helper: function to create default document categories for a new company
create or replace function create_default_document_categories(p_company_id uuid) returns void language plpgsql as $$
begin
  insert into document_categories (company_id, name, retention_months, access_level, requires_signature, is_system, sort_order) values
  (p_company_id, 'Dienstvertrag', 120, 'hr_only', true, true, 1),
  (p_company_id, 'Lohnzettel', 84, 'payroll_and_hr', false, true, 2),
  (p_company_id, 'Krankmeldung', 36, 'hr_only', false, true, 3),
  (p_company_id, 'Arbeitsbescheinigung', 84, 'hr_only', false, true, 4),
  (p_company_id, 'Reisekostenabrechnung', 84, 'manager_and_hr', false, true, 5),
  (p_company_id, 'Bewerbungsunterlagen', 36, 'hr_only', false, true, 6),
  (p_company_id, 'Weiterbildungsnachweis', 60, 'manager_and_hr', false, true, 7),
  (p_company_id, 'Betriebsvereinbarung', 0, 'all_staff', false, true, 8),
  (p_company_id, 'Arbeitsbewilligung', 24, 'hr_only', false, true, 9),
  (p_company_id, 'Sonstiges', 0, 'hr_only', false, false, 99)
  on conflict do nothing;
end;
$$;

-- Trigger: auto-init company defaults after insert
create or replace function on_company_created() returns trigger language plpgsql security definer as $$
begin
  perform create_default_absence_types(new.id);
  perform create_default_document_categories(new.id);
  insert into company_settings (company_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger company_defaults_trigger after insert on companies for each row execute function on_company_created();
