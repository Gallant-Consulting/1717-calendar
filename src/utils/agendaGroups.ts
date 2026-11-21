import type { Event } from '../types';
import { formatDateInputEastern } from './eventTime';

export type AgendaDay = {
  /** Eastern calendar day, `YYYY-MM-DD`. */
  key: string;
  /** First event's start; use the Eastern formatters on it for the day label. */
  date: Date;
  events: Event[];
};

export type AgendaMonth = {
  /** Eastern calendar month, `YYYY-MM`. */
  key: string;
  /** Local-midnight first of the month, for syncing the month calendar. */
  month: Date;
  days: AgendaDay[];
};

/** `YYYY-MM-DD` of the instant in US Eastern — the day an event is listed under. */
export function easternDayKey(date: Date): string {
  return formatDateInputEastern(date);
}

/**
 * Group an already-ordered (and already search-filtered) event list into months, then days.
 * Keeps first-seen order at every level so the list matches the order `App` chose; each Eastern
 * day appears once, holding every event that starts on it.
 */
export function groupEventsByMonthAndDay(events: Event[]): AgendaMonth[] {
  const months: AgendaMonth[] = [];
  const monthByKey = new Map<string, AgendaMonth>();
  const dayByKey = new Map<string, AgendaDay>();

  for (const event of events) {
    const dayKey = easternDayKey(event.startDate);
    const monthKey = dayKey.slice(0, 7);

    let month = monthByKey.get(monthKey);
    if (!month) {
      const [y, m] = monthKey.split('-').map(Number);
      month = { key: monthKey, month: new Date(y, m - 1, 1), days: [] };
      monthByKey.set(monthKey, month);
      months.push(month);
    }

    let day = dayByKey.get(dayKey);
    if (!day) {
      day = { key: dayKey, date: event.startDate, events: [] };
      dayByKey.set(dayKey, day);
      month.days.push(day);
    }
    day.events.push(event);
  }

  return months;
}
