// Application-level role permission utilities.
// Database RLS controls row access; this controls column/field visibility in UI.

type Role =
  | "super_admin" | "company_admin" | "hr_manager" | "hr_staff"
  | "manager" | "payroll" | "employee" | "read_only" | null | undefined;

const HR_ROLES: Role[] = ["super_admin", "company_admin", "hr_manager", "hr_staff"];
const PAYROLL_ROLES: Role[] = [...HR_ROLES, "payroll"];

// Pfändung hidden from manager, read_only, employee
export function canSeePfaendung(role: Role): boolean {
  return PAYROLL_ROLES.includes(role);
}

// brutto/Vergütung hidden from manager, read_only, employee
export function canSeeBrutto(role: Role): boolean {
  return PAYROLL_ROLES.includes(role);
}

// Edit employee records — HR roles only
export function canEditEmployee(role: Role): boolean {
  return HR_ROLES.includes(role);
}

// Austritt workflow — HR roles only
export function canTriggerAustritt(role: Role): boolean {
  return HR_ROLES.includes(role);
}

// Status Management page access
export function canAccessStatusPage(role: Role): boolean {
  return HR_ROLES.includes(role) || role === "payroll";
}
