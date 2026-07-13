-- Migration 015: Fix handle_new_user — company_id aus raw_user_meta_data lesen
--
-- Problem: Trigger hardcodete die Bäckerei-company_id ('2d01aaeb-...').
-- Jede Registrierung über die Sustainista-App legte Mitarbeiter bei der
-- falschen Firma an (DSGVO-Datenvermischung, kritisch).
--
-- Fix: company_id kommt aus raw_user_meta_data->>'company_id'.
-- Ist kein company_id übergeben, wird kein Mitarbeiter angelegt —
-- stattdessen nur ein Profil ohne employee_id (muss admin manuell zuweisen).
-- Das verhindert stille Datenvermischung.
--
-- Aufruf-Seite (Next.js):
--   supabase.auth.signUp({
--     email, password,
--     options: { data: { first_name, last_name, company_id } }
--   })

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_employee_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- company_id muss explizit bei der Registrierung übergeben werden.
  -- Fehlt sie, landet kein Mitarbeiter bei der falschen Firma.
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;

  IF v_company_id IS NOT NULL THEN
    -- Prüfen ob die company_id überhaupt existiert (verhindert FK-Fehler)
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) THEN
      v_company_id := NULL;
    END IF;
  END IF;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.employees (
      company_id,
      first_name,
      last_name,
      contact_email,
      employment_type,
      entry_date,
      is_active,
      custom_fields
    ) VALUES (
      v_company_id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      NEW.email,
      'vollzeit',
      CURRENT_DATE,
      false,
      '{"status": "pending", "onboarding_step": "personal"}'::jsonb
    )
    RETURNING id INTO v_employee_id;
  END IF;

  INSERT INTO public.profiles (
    id,
    company_id,
    employee_id,
    role,
    is_active
  ) VALUES (
    NEW.id,
    v_company_id,
    v_employee_id,
    'employee',
    false
  );

  RETURN NEW;
END;
$$;
