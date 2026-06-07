// Österreichische gesetzliche Feiertage (§ 7 ARG)
export const AT_HOLIDAYS: Record<string, string> = {
  "2025-01-01": "Neujahr",
  "2025-01-06": "Heilige Drei Könige",
  "2025-04-21": "Ostermontag",
  "2025-05-01": "Staatsfeiertag",
  "2025-05-29": "Christi Himmelfahrt",
  "2025-06-09": "Pfingstmontag",
  "2025-06-19": "Fronleichnam",
  "2025-08-15": "Mariä Himmelfahrt",
  "2025-10-26": "Nationalfeiertag",
  "2025-11-01": "Allerheiligen",
  "2025-12-08": "Mariä Empfängnis",
  "2025-12-25": "Weihnachten",
  "2025-12-26": "Stefanitag",
  "2026-01-01": "Neujahr",
  "2026-01-06": "Heilige Drei Könige",
  "2026-04-06": "Ostermontag",
  "2026-05-01": "Staatsfeiertag",
  "2026-05-14": "Christi Himmelfahrt",
  "2026-05-25": "Pfingstmontag",
  "2026-06-04": "Fronleichnam",
  "2026-08-15": "Mariä Himmelfahrt",
  "2026-10-26": "Nationalfeiertag",
  "2026-11-01": "Allerheiligen",
  "2026-12-08": "Mariä Empfängnis",
  "2026-12-25": "Weihnachten",
  "2026-12-26": "Stefanitag",
};

export function isHoliday(dateStr: string): boolean {
  return dateStr in AT_HOLIDAYS;
}

export function getHolidayName(dateStr: string): string | undefined {
  return AT_HOLIDAYS[dateStr];
}
