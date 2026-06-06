import type { Event } from '../types';

/** Alternating accents for schedule list and calendar: pink → amber → cyan. */
export const SCHEDULE_EVENT_ACCENT_COLORS = ['#FF6038', '#E8A84A', '#5AAFCA'] as const;

/** Primary accent for app chrome (header, calendar nav) — same as first event accent. */
export const SCHEDULE_PRIMARY_ACCENT = SCHEDULE_EVENT_ACCENT_COLORS[0];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

type MonthGroup = { key: string; month: Date; items: Event[] };

/** Same grouping as `EventList`: first-seen month order, then insertion order within the month. */
function groupEventsByMonth(events: Event[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const event of events) {
    const eventMonth = new Date(event.startDate.getFullYear(), event.startDate.getMonth(), 1);
    const key = monthKey(eventMonth);
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(event);
    } else {
      groups.push({ key, month: eventMonth, items: [event] });
    }
  }
  return groups;
}

/**
 * Accent color for an event in the schedule, consistent with `EventList` cards.
 * `eventsInOrder` must be the same ordered array used for calendar + accent lookup (e.g. filtered upcoming events).
 */
export function getScheduleAccentColor(event: Event, eventsInOrder: Event[]): string {
  const groups = groupEventsByMonth(eventsInOrder);
  let idx = 0;
  for (const g of groups) {
    for (const e of g.items) {
      if (e.id === event.id) {
        return SCHEDULE_EVENT_ACCENT_COLORS[idx % SCHEDULE_EVENT_ACCENT_COLORS.length];
      }
      idx++;
    }
  }
  return SCHEDULE_EVENT_ACCENT_COLORS[0];
}
