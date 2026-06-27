-- Migration 013: auto-create employee + profile on signup
-- SECURITY DEFINER bypasses RLS regardless of session state.
-- first_name / last_name come from raw_user_meta_data set during signUp.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid := '2d01aaeb-47c2-4a34-8d37-3bfeb6deda91'::uuid;
  v_employee_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
