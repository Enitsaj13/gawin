export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year, month - 1, day, 12);
}

export function shiftDateKey(dateKey: string, amount: number) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + amount);

  return toDateKey(date);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function formatJournalDate(dateKey: string) {
  const date = fromDateKey(dateKey);
  const month = date.toLocaleDateString('en-US', { month: 'short' });

  return `${String(date.getDate()).padStart(2, '0')},${month},${date.getFullYear()}`;
}

export function formatWeekday(dateKey: string, short = false) {
  return fromDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: short ? 'short' : 'long',
  });
}

export function recentDateKeys(startDateKey: string, count: number) {
  return Array.from({ length: count }, (_, index) => shiftDateKey(startDateKey, -(index + 1)));
}
