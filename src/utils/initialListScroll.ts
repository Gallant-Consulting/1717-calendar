/** Start of the user's local calendar day (matches `dayKeyLocal` in EventList). */
export function localCalendarDayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

  const futureOrTodayStart = events.find(
    (e) => localCalendarDayStart(e.startDate).getTime() >= todayStart.getTime(),
  );
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
