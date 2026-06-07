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

export interface Win {
  $id: string;
  employeeId: string;
  weekLabel: string;
  content: string;
  impact?: string;
  tags?: string;
  $createdAt: string;
  $updatedAt: string;
}

export interface CheckIn {
  $id: string;
  employeeId: string;
  weekLabel: string;
  energyLevel: number;
  priority: string;
  blocker?: string;
  satisfaction?: number;
  $createdAt: string;
  $updatedAt: string;
}

export interface OKR {
  $id: string;
  employeeId: string;
  quarter: string;
  objective: string;
  keyResults: string;
  progress: number;
  status?: "on-track" | "at-risk" | "done";
  $createdAt: string;
  $updatedAt: string;
}

export interface KaizenItem {
  $id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  category?: string;
  status?: "open" | "in-progress" | "done" | "declined";
  adminComment?: string;
  upvotes?: number;
  $createdAt: string;
  $updatedAt: string;
}

export interface PerformanceReview {
  $id: string;
  employeeId: string;
  period: string;
  selfAssessment?: string;
  managerAssessment?: string;
  selfScore?: number;
  managerScore?: number;
  strengths?: string;
  growthAreas?: string;
  status?: "self-pending" | "manager-pending" | "complete";
  reviewedBy?: string;
  $createdAt: string;
  $updatedAt: string;
}
