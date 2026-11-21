import { describe, expect, it } from 'vitest';
import type { Event } from '../types';
import { easternDayKey, groupEventsByMonthAndDay } from './agendaGroups';
import { eventMatchesQuery } from './eventSearch';

function ev(id: string, iso: string, extra: Partial<Event> = {}): Event {
  const start = new Date(iso);
  return { id, title: id, startDate: start, endDate: start, isAllDay: false, ...extra };
}

describe('easternDayKey', () => {
  it('uses the Eastern calendar day, not UTC', () => {
    // 7 PM EST on Nov 20 is already Nov 21 in UTC.
    expect(easternDayKey(new Date('2026-11-21T00:00:00.000Z'))).toBe('2026-11-20');
  });
});

describe('groupEventsByMonthAndDay', () => {
  const events = [
    ev('coffee', '2026-11-20T14:00:00Z', { title: 'Regional Coffee Connection' }),
    ev('jobfair', '2026-11-20T15:00:00Z', { title: 'Maxim Healthcare Job Fair' }),
    ev('evening', '2026-11-21T00:00:00Z', { title: 'TNI After Hours' }), // still Nov 20 in Eastern
    ev('mend', '2026-11-21T17:00:00Z', { title: 'Mend Friend with Top Stitch' }),
    ev('friday', '2026-11-27T05:00:00Z', { title: 'Black Friday Weekend', hostOrganization: 'Carytown Merchants' }),
    ev('dec', '2026-12-02T15:00:00Z', { title: 'Walk-In Wednesdays' }),
  ];

  it('lists each Eastern day once, holding every event that starts on it, in order', () => {
    const months = groupEventsByMonthAndDay(events);
    expect(months.map((m) => m.key)).toEqual(['2026-11', '2026-12']);
    expect(months[0].days.map((d) => d.key)).toEqual(['2026-11-20', '2026-11-21', '2026-11-27']);
    expect(months[0].days[0].events.map((e) => e.id)).toEqual(['coffee', 'jobfair', 'evening']);
    expect(months[1].days[0].events.map((e) => e.id)).toEqual(['dec']);
  });

  it('gives the calendar a local first-of-month date', () => {
    const [nov] = groupEventsByMonthAndDay(events);
    expect(nov.month.getFullYear()).toBe(2026);
    expect(nov.month.getMonth()).toBe(10);
    expect(nov.month.getDate()).toBe(1);
  });

  it('only shows days that still have a match after search filtering', () => {
    const filtered = events.filter((e) => eventMatchesQuery(e, 'carytown'));
    const months = groupEventsByMonthAndDay(filtered);
    expect(months).toHaveLength(1);
    expect(months[0].days.map((d) => d.key)).toEqual(['2026-11-27']);

    // A match on a busy day keeps that day but drops the day's other events.
    const afterHours = groupEventsByMonthAndDay(events.filter((e) => eventMatchesQuery(e, 'after hours')));
    expect(afterHours[0].days.map((d) => [d.key, d.events.map((e) => e.id)])).toEqual([['2026-11-20', ['evening']]]);
  });

  it('returns nothing for an empty list', () => {
    expect(groupEventsByMonthAndDay([])).toEqual([]);
  });
});
