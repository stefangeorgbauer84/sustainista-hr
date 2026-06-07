import type { Employee, TimeEntry, LeaveRequest } from "@/types";
import { calcWorkedMinutes, formatDuration } from "./time";

export function exportTimeEntriesCSV(
  entries: TimeEntry[],
  employees: Employee[],
  month: number,
  year: number
): void {
  const empMap = Object.fromEntries(employees.map(e => [e.$id, e]));
  const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

  const rows: string[][] = [
    ["Mitarbeiter", "Datum", "Von", "Bis", "Pause (Min)", "Netto (h)", "Status", "Notiz"],
  ];

  entries
    .filter(e => e.status !== "running")
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(entry => {
      const emp = empMap[entry.employeeId];
      const name = emp ? `${emp.lastName} ${emp.firstName}` : entry.employeeId;
      const mins = calcWorkedMinutes(entry);
      const hours = (mins / 60).toFixed(2);
      rows.push([
        name,
        entry.date,
        entry.startTime,
        entry.endTime ?? "",
        String(entry.breakMinutes),
        hours,
        entry.status,
        entry.note ?? "",
      ]);
    });

  // Überstunden-Zusammenfassung pro Mitarbeiter
  rows.push([], ["=== Zusammenfassung ==="], ["Mitarbeiter", "Gesamtstunden", "Soll (160h)", "Differenz"]);
  const byEmp: Record<string, number> = {};
  entries.filter(e => e.status !== "running").forEach(e => {
    byEmp[e.employeeId] = (byEmp[e.employeeId] ?? 0) + calcWorkedMinutes(e);
  });
  Object.entries(byEmp).forEach(([empId, mins]) => {
    const emp = empMap[empId];
    const name = emp ? `${emp.lastName} ${emp.firstName}` : empId;
    const diff = mins - 160 * 60;
    rows.push([name, (mins / 60).toFixed(2), "160.00", (diff / 60).toFixed(2)]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM für Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Zeitbericht_${MONTHS[month - 1]}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLeaveCSV(leaves: LeaveRequest[], year: number): void {
  const typeLabels: Record<string, string> = {
    vacation: "Urlaub", sick: "Krankenstand", unpaid: "Unbezahlt", special: "Sonder",
  };

  const rows: string[][] = [
    ["Mitarbeiter", "Typ", "Von", "Bis", "Werktage", "Status", "Genehmigt am", "Anmerkung"],
    ...leaves.map(l => [
      l.employeeName,
      typeLabels[l.type] ?? l.type,
      l.startDate,
      l.endDate,
      String(l.days),
      l.status,
      l.approvedAt ? l.approvedAt.split("T")[0] : "",
      l.reason ?? "",
    ]),
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Urlaubsliste_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
