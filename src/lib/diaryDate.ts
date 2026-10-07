/**
 * Diary days run from local noon until the following noon.
 * Use calendar arithmetic so daylight-saving changes do not move the cutoff.
 * The returned date represents a calendar day, not the actual posting time.
 */
export function getDiaryDate(value: string | Date = new Date()): Date {
  const date = new Date(value);
  if (date.getHours() < 12) date.setDate(date.getDate() - 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getDiaryDateKey(value: string | Date = new Date()): string {
  return formatDateKey(getDiaryDate(value));
}
