export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIsoDate(): string {
  return formatDateForInput(new Date());
}

export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysToIsoDate(iso: string, days: number): string {
  const date = isoToLocalDate(iso);
  date.setDate(date.getDate() + days);
  return formatDateForInput(date);
}

export function compareIsoDates(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function endOfWeekIsoDate(referenceIso: string): string {
  const date = isoToLocalDate(referenceIso);
  const day = date.getDay();
  const daysUntilSunday = (7 - day) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return formatDateForInput(date);
}
