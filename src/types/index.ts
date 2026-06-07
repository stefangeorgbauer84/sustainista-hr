export type UserRole = "admin" | "employee";
export type EmployeeStatus = "pending" | "active" | "rejected";

export interface AppwriteUser {
  $id: string;
  email: string;
  name: string;
  labels: string[];
  prefs: Record<string, unknown>;
}

export interface Employee {
  $id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: EmployeeStatus;
  department: string;
  position: string;
  startDate: string;
  vacationDaysTotal: number;
  vacationDaysUsed: number;
  bankAccount?: string;
  phone?: string;
  address?: string;
  onboardingStep?: string;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  googleRefreshToken?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface TimeEntry {
  $id: string;
  employeeId: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime?: string; // HH:mm — null if still running
  breakMinutes: number;
  note?: string;
  status: "running" | "completed" | "approved" | "rejected";
  approvedBy?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface LeaveRequest {
  $id: string;
  employeeId: string;
  employeeName: string;
  type: "vacation" | "sick" | "unpaid" | "special";
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  sickNote?: string; // file ID for uploaded document
  $createdAt: string;
  $updatedAt: string;
}

export interface Document {
  $id: string;
  employeeId: string;
  type: "payslip" | "contract" | "other";
  title: string;
  fileId: string;
  month?: string; // e.g. "2025-01"
  uploadedBy: string;
  $createdAt: string;
}

export interface WorkStats {
  totalHoursThisMonth: number;
  overtimeHours: number;
  vacationDaysLeft: number;
  sickDaysThisYear: number;
  currentlyRunning: boolean;
}
