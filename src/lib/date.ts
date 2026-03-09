import { addDays, endOfMonth } from 'date-fns';

export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

export function getDateKeyInTimeZone(date: Date = new Date(), timeZone = BRAZIL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, amount: number) {
  return formatDateKey(addDays(parseDateKey(dateKey), amount));
}

export function endOfMonthDateKey(dateKey: string) {
  return formatDateKey(endOfMonth(parseDateKey(dateKey)));
}
