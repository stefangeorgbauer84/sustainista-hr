import { databases, DB_ID, COLLECTIONS } from "./appwrite";
import { ID, Query } from "appwrite";
import type { LeaveRequest } from "@/types";
import { differenceInBusinessDays, parseISO, addDays } from "date-fns";

// Austrian public holidays 2025/2026 (§ 7 ARG)
const AT_HOLIDAYS = [
  "2025-01-01", "2025-01-06", "2025-04-21", "2025-05-01",
  "2025-05-29", "2025-06-09", "2025-06-19", "2025-08-15",
  "2025-10-26", "2025-11-01", "2025-12-08", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-01-06", "2026-04-06", "2026-05-01",
  "2026-05-14", "2026-05-25", "2026-06-04", "2026-08-15",
  "2026-10-26", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26",
];

export function calcBusinessDays(start: string, end: string): number {
  let count = 0;
  let current = parseISO(start);
  const endDate = parseISO(end);
  while (current <= endDate) {
    const iso = current.toISOString().split("T")[0];
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6 && !AT_HOLIDAYS.includes(iso)) count++;
    current = addDays(current, 1);
  }
  return count;
}

export async function createLeaveRequest(
  employeeId: string,
  employeeName: string,
  data: Omit<LeaveRequest, "$id" | "$createdAt" | "$updatedAt" | "status" | "days" | "employeeId" | "employeeName">
): Promise<LeaveRequest> {
  const days = calcBusinessDays(data.startDate, data.endDate);
  return databases.createDocument(DB_ID, COLLECTIONS.LEAVE_REQUESTS, ID.unique(), {
    employeeId,
    employeeName,
    ...data,
    days,
    status: "pending",
  }) as unknown as LeaveRequest;
}

export async function getLeaveRequestsForEmployee(employeeId: string): Promise<LeaveRequest[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.LEAVE_REQUESTS, [
    Query.equal("employeeId", employeeId),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return res.documents as unknown as LeaveRequest[];
}

export async function getAllPendingRequests(): Promise<LeaveRequest[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.LEAVE_REQUESTS, [
    Query.equal("status", "pending"),
    Query.orderAsc("startDate"),
    Query.limit(100),
  ]);
  return res.documents as unknown as LeaveRequest[];
}

export async function approveLeave(requestId: string, adminId: string): Promise<LeaveRequest> {
  return databases.updateDocument(DB_ID, COLLECTIONS.LEAVE_REQUESTS, requestId, {
    status: "approved",
    approvedBy: adminId,
    approvedAt: new Date().toISOString(),
  }) as unknown as LeaveRequest;
}

export async function rejectLeave(requestId: string, adminId: string): Promise<LeaveRequest> {
  return databases.updateDocument(DB_ID, COLLECTIONS.LEAVE_REQUESTS, requestId, {
    status: "rejected",
    approvedBy: adminId,
    approvedAt: new Date().toISOString(),
  }) as unknown as LeaveRequest;
}

export async function getApprovedLeaveForCalendar(): Promise<LeaveRequest[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.LEAVE_REQUESTS, [
    Query.equal("status", "approved"),
    Query.orderAsc("startDate"),
    Query.limit(200),
  ]);
  return res.documents as unknown as LeaveRequest[];
}
