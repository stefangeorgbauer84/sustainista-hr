import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatDateAT(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeAT(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy HH:mm", { locale: de });
  } catch {
    return dateStr;
  }
}

export const AT_MONTHS = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export function formatMonthYearAT(month: number, year: number): string {
  return `${AT_MONTHS[month - 1]} ${year}`;
}
