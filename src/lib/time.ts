import { databases, DB_ID, COLLECTIONS } from "./appwrite";
import { ID, Query } from "appwrite";
import type { TimeEntry } from "@/types";

export async function startTimer(employeeId: string, note?: string): Promise<TimeEntry> {
  const now = new Date();
  return databases.createDocument(DB_ID, COLLECTIONS.TIME_ENTRIES, ID.unique(), {
    employeeId,
    date: now.toISOString().split("T")[0],
    startTime: now.toTimeString().slice(0, 5),
    breakMinutes: 0,
    status: "running",
    note: note ?? null,
  }) as unknown as TimeEntry;
}

export async function stopTimer(entryId: string): Promise<TimeEntry> {
  const now = new Date();
  return databases.updateDocument(DB_ID, COLLECTIONS.TIME_ENTRIES, entryId, {
    endTime: now.toTimeString().slice(0, 5),
    status: "completed",
  }) as unknown as TimeEntry;
}

export async function getRunningEntry(employeeId: string): Promise<TimeEntry | null> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.TIME_ENTRIES, [
    Query.equal("employeeId", employeeId),
    Query.equal("status", "running"),
    Query.limit(1),
  ]);
  return (res.documents[0] as unknown as TimeEntry) ?? null;
}

export async function getTimeEntriesForEmployee(
  employeeId: string,
  year: number,
  month: number
): Promise<TimeEntry[]> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.TIME_ENTRIES, [
    Query.equal("employeeId", employeeId),
    Query.greaterThanEqual("date", start),
    Query.lessThanEqual("date", end),
    Query.orderDesc("date"),
    Query.limit(100),
  ]);
  return res.documents as unknown as TimeEntry[];
}

export function calcWorkedMinutes(entry: TimeEntry): number {
  if (!entry.endTime) return 0;
  const [sh, sm] = entry.startTime.split(":").map(Number);
  const [eh, em] = entry.endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm) - entry.breakMinutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
