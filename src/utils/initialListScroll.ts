/** Start of the user's local calendar day (matches `dayKeyLocal` in EventList). */
export function localCalendarDayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function eventStartsOnOrAfterDay(
  event: { startDate: Date },
  day: Date,
): boolean {
  return localCalendarDayStart(event.startDate).getTime() >= localCalendarDayStart(day).getTime();
}

/**
 * Schedule list order: events starting on/after `now`'s local day first (by start),
 * then still-relevant past-start rows (year-long programs, etc.) so March does not lead.
 */
export function orderEventsForScheduleList<T extends { startDate: Date; endDate: Date }>(
  events: T[],
  now: Date = new Date(),
): T[] {
  const todayStart = localCalendarDayStart(now);
  const upcoming: T[] = [];
  const pastStart: T[] = [];
  for (const event of events) {
    if (eventStartsOnOrAfterDay(event, todayStart)) upcoming.push(event);
    else pastStart.push(event);
  }
  const byStart = (a: T, b: T) => a.startDate.getTime() - b.startDate.getTime();
  upcoming.sort(byStart);
  pastStart.sort(byStart);
  return [...upcoming, ...pastStart];
}

/** True when more API pages should be fetched so the list can open near today. */
export function shouldPrefetchMoreForTodayAnchor(
  events: { startDate: Date }[],
  now: Date,
  hasMore: boolean,
): boolean {
  if (!hasMore) return false;
  return !events.some((e) => eventStartsOnOrAfterDay(e, now));
}

/**
 * Pick which local calendar day the schedule list should scroll to on first load:
 * first event starting on/after today, else today when something is still ongoing
 * (covers year-long rows whose start month must not drive the calendar), else first row.
 */
export function pickInitialListScrollDay(
  events: { startDate: Date; endDate: Date }[],
  now: Date = new Date(),
): Date | null {
  if (events.length === 0) return null;
  const todayStart = localCalendarDayStart(now);

  const futureOrTodayStart = events.find((e) => eventStartsOnOrAfterDay(e, todayStart));
  if (futureOrTodayStart) {
    return localCalendarDayStart(futureOrTodayStart.startDate);
  }

  // Ongoing (or covering) events that started earlier: stay on today so the calendar
  // does not jump to March/June/etc. for year-long Airtable rows on page 1.
  const ongoing = events.some((e) => e.endDate >= todayStart);
  if (ongoing) {
    return todayStart;
  }

  return localCalendarDayStart(events[0].startDate);
}
