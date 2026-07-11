import type { UserRole } from "@/types";

export type PermissionAction =
  | "view:payroll"
  | "view:pfaendung"
  | "view:brutto"
  | "edit:employee"
  | "trigger:austritt"
  | "access:status-page"
  | "bulk:approve"
  | "export:payroll";

const HR_ROLES: UserRole[] = ["super_admin", "company_admin", "hr_manager", "hr_staff"];
const PAYROLL_ROLES: UserRole[] = [...HR_ROLES, "payroll"];

const PERMISSIONS: Record<PermissionAction, readonly UserRole[]> = {
  "view:payroll": PAYROLL_ROLES,
  "view:pfaendung": PAYROLL_ROLES,
  "view:brutto": PAYROLL_ROLES,
  "edit:employee": HR_ROLES,
  "trigger:austritt": HR_ROLES,
  "access:status-page": [...HR_ROLES, "payroll"],
  "bulk:approve": HR_ROLES,
  "export:payroll": PAYROLL_ROLES,
};

export function hasPermission(
  role: UserRole | null | undefined,
  action: PermissionAction
): boolean {
  if (!role) return false;
  return (PERMISSIONS[action] as UserRole[]).includes(role);
}

/** Strip salary/garnishment data for roles without payroll access. */
export function stripSensitiveForRole<
  T extends { custom_fields?: Record<string, unknown> },
>(employee: T, role: UserRole | null | undefined): T {
  if (hasPermission(role, "view:brutto")) return employee;
  if (!employee.custom_fields) return employee;
  const cf = { ...employee.custom_fields };
  delete cf["brutto"];
  delete cf["pfaendung"];
  delete cf["pfaendung_betrag"];
  delete cf["pfaendung_glaeubiger"];
  return { ...employee, custom_fields: cf };
}
