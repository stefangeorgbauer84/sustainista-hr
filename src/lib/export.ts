import type { Employee, TimeRecord, Absence } from "@/types";
import { calcWorkedMinutes } from "./time";

export function exportTimeEntriesCSV(
  entries: TimeRecord[],
  employees: Employee[],
  month: number,
  year: number
): void {
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

  const rows: string[][] = [
    ["Mitarbeiter", "Datum", "Von", "Bis", "Pause (Min)", "Netto (h)", "Status", "Notiz"],
  ];

  entries
    .filter(e => e.end_time !== null)
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .forEach(entry => {
      const emp = empMap[entry.employee_id];
      const name = emp ? `${emp.last_name} ${emp.first_name}` : entry.employee_id;
      const mins = calcWorkedMinutes(entry);
      const hours = (mins / 60).toFixed(2);
      rows.push([
        name,
        entry.work_date,
        entry.start_time,
        entry.end_time ?? "",
        String(entry.break_minutes),
        hours,
        entry.status,
        entry.notes ?? "",
      ]);
    });

  rows.push([], ["=== Zusammenfassung ==="], ["Mitarbeiter", "Gesamtstunden", "Soll (160h)", "Differenz"]);
  const byEmp: Record<string, number> = {};
  entries.filter(e => e.end_time !== null).forEach(e => {
    byEmp[e.employee_id] = (byEmp[e.employee_id] ?? 0) + calcWorkedMinutes(e);
  });
  Object.entries(byEmp).forEach(([empId, mins]) => {
    const emp = empMap[empId];
    const name = emp ? `${emp.last_name} ${emp.first_name}` : empId;
    const diff = mins - 160 * 60;
    rows.push([name, (mins / 60).toFixed(2), "160.00", (diff / 60).toFixed(2)]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Zeitbericht_${MONTHS[month - 1]}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLeaveCSV(leaves: Absence[], year: number): void {
  const rows: string[][] = [
    ["Mitarbeiter-ID", "Typ-ID", "Von", "Bis", "Werktage", "Status", "Genehmigt am", "Grund"],
    ...leaves.map(l => [
      l.employee_id,
      l.absence_type_id,
      l.start_date,
      l.end_date,
      String(l.working_days ?? ""),
      l.status,
      l.approved_at ? l.approved_at.split("T")[0] : "",
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
