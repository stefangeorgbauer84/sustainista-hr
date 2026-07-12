-- Security-Härtung lt. Supabase Advisors (2026-07-11), bereits via MCP angewendet:
-- 1) Fixer search_path für alle Funktionen (verhindert search_path-Hijacking)
-- 2) EXECUTE-Rechte einschränken: Trigger-/Setup-Funktionen für niemanden via RPC,
--    RLS-Helper nur für authenticated (werden in Policies aufgerufen)

alter function public.get_my_company_id() set search_path = public;
alter function public.get_my_employee_id() set search_path = public;
alter function public.get_my_role() set search_path = public;
alter function public.has_role(public.user_role) set search_path = public;
alter function public.has_any_role(public.user_role[]) set search_path = public;
alter function public.is_hr_or_above() set search_path = public;
alter function public.is_super_admin() set search_path = public;
alter function public.employee_history_trigger() set search_path = public;
alter function public.check_time_warnings() set search_path = public;
alter function public.universal_audit_trigger() set search_path = public;
alter function public.create_default_absence_types(uuid) set search_path = public;
alter function public.create_default_document_categories(uuid) set search_path = public;
alter function public.on_company_created() set search_path = public;
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.employee_history_trigger() from public, anon, authenticated;
revoke execute on function public.universal_audit_trigger() from public, anon, authenticated;
revoke execute on function public.check_time_warnings() from public, anon, authenticated;
revoke execute on function public.on_company_created() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_default_absence_types(uuid) from public, anon, authenticated;
revoke execute on function public.create_default_document_categories(uuid) from public, anon, authenticated;

revoke execute on function public.get_my_company_id() from public, anon;
revoke execute on function public.get_my_employee_id() from public, anon;
revoke execute on function public.get_my_role() from public, anon;
revoke execute on function public.has_role(public.user_role) from public, anon;
revoke execute on function public.has_any_role(public.user_role[]) from public, anon;
revoke execute on function public.is_hr_or_above() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.get_my_company_id() to authenticated;
grant execute on function public.get_my_employee_id() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.has_role(public.user_role) to authenticated;
grant execute on function public.has_any_role(public.user_role[]) to authenticated;
grant execute on function public.is_hr_or_above() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
