# Dienstplan Feature — HR Tool Bäckerei Karl Bauer

## Ziel

Visuell starke Dienstplanverwaltung je Filiale. Admins erstellen/bearbeiten Schichtpläne, die direkt Zeiterfassungsdaten erzeugen. Mitarbeiter:innen sehen ihren Plan (read-only) und können Änderungen anfragen.

---

## Step 1 — DB Schema: shift_schedules & schedule_change_requests

Implement two new tables via Supabase migration.

`shift_schedules`: id, company_id, employee_id, location_id, scheduled_date (date), start_time (time), end_time (time), break_minutes (int default 30), status (draft|published|cancelled), notes (text), created_by (uuid), created_at, updated_at. Unique on (employee_id, scheduled_date, location_id).

`schedule_change_requests`: id, company_id, shift_schedule_id (FK), employee_id, requested_start (time), requested_end (time), break_minutes (int), reason (text), status (pending|approved|rejected), admin_note (text), resolved_at, created_at.

RLS: company_admin/hr can manage all rows for their company_id. Employees read own rows only.

Out of scope: payroll export integration.

---

## Step 2 — Types + Query Helpers

Add TypeScript interfaces `ShiftSchedule` and `ScheduleChangeRequest` to `src/types/index.ts`. Create `src/lib/schedule.ts` with helper functions: `getScheduleForLocation(locationId, weekStart)`, `getScheduleForEmployee(employeeId, year, month)`, `publishShifts(shiftIds[])`, `getChangeRequests(status?)`.

Out of scope: caching layer, SWR.

---

## Step 3 — Admin Dienstplan Page: Visual Weekly Grid per Filiale

Create `/admin/schedule` page with:
- Filiale selector (dropdown from locations)
- Week navigator (prev/next week arrows + current week label)
- Grid layout: rows = employees assigned to that Filiale, columns = 7 days (Mon–Sun)
- Each cell shows the shift (start–end time, break badge, hours total) or empty state
- Click cell → inline editor (start time, end time, break minutes, notes)
- Color coding: draft=gray, published=green, cancelled=red, today=highlighted
- "Woche veröffentlichen" button → sets all draft shifts of that week/location to published
- Hours summary row at bottom: total scheduled hours per day + week total

Out of scope: drag-and-drop (later iteration), recurring shifts.

---

## Step 4 — Admin Hours Summary per Employee

Add hours summary section to `/admin/schedule` (or separate tab):
- Per-employee card: employee name, location badge(s), scheduled hours this week, scheduled hours this month
- Comparison: scheduled vs actual (from time_records where status=approved)
- Month selector
- Highlight employees where scheduled differs from actual by more than 2h

Out of scope: payroll calculation.

---

## Step 5 — Employee Dienstplan View (Read-Only)

Create `/dashboard/schedule` page:
- Read-only weekly view of own shifts across all assigned Filialen
- Week navigator
- Each shift shows: date, Filiale name, start–end time, break, net hours
- Month summary at bottom: total scheduled hours vs target (from employee.hours_per_week)
- "Änderung anfragen" button on each published shift

Add "Dienstplan" link to employee sidebar nav.

Out of scope: iCal export (later iteration).

---

## Step 6 — Employee Change Request Flow

From the employee schedule view, clicking "Änderung anfragen" opens a modal:
- Current shift details (read-only)
- Fields: new start time, new end time, break minutes, reason (required)
- Submit → inserts into schedule_change_requests with status=pending
- Pending requests shown with status badge under the shift
- Employee can cancel own pending requests

---

## Step 7 — Admin Change Request Management

Admin receives and acts on change requests:
- Badge on Sidebar "Dienstplan" nav item showing count of pending requests
- Section in `/admin/schedule` listing pending change requests per Filiale
- Each request: employee name, shift date, current vs requested times, reason
- Approve → updates shift_schedule to requested times, sets request status=approved, adds optional admin_note
- Reject → sets status=rejected with admin_note

---

## Step 8 — Sync Published Shifts to time_records

When a shift is published (or change request approved), create or upsert a time_records entry:
- work_date = shift.scheduled_date
- start_time = shift.start_time
- end_time = shift.end_time
- break_minutes = shift.break_minutes
- status = draft (employee can still submit)
- created_via = schedule
- employee_id, location_id, company_id from shift

This ensures the time record reflects the scheduled plan. Employee timer page shows these pre-filled entries. If a time_record already exists for that date (manually entered), do not overwrite — show a conflict warning to admin instead.

Out of scope: retroactive sync of past shifts.
