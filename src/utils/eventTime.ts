/** User-visible event times use US Eastern. Stored values remain ISO instants (`Date` / API strings). */

export const EVENT_TIME_ZONE = 'America/New_York';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const time24Fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const monthShortFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  month: 'short',
});

const monthLongFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  month: 'long',
});

const dayNumFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  day: 'numeric',
});

const shortWeekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  weekday: 'short',
});

const longWeekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  weekday: 'long',
});

const searchDateFmtLong = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  month: 'long',
  year: 'numeric',
  day: 'numeric',
});

const searchDateFmtShort = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  month: 'short',
  year: 'numeric',
  day: 'numeric',
});

const yearFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
});

export function formatEventDateEastern(date: Date): string {
  return dateFmt.format(date);
}

export function formatEventTimeEastern(date: Date): string {
  return timeFmt.format(date);
}

/** `YYYY-MM-DD` for `<input type="date" />` in Eastern for this instant. */
export function formatDateInputEastern(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  return date.toISOString().slice(0, 10);
}

/** `HH:mm` for `<input type="time" />` in Eastern (24h). */
export function formatTimeInputEastern(date: Date): string {
  const parts = time24Fmt.formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function formatEventDateTimeRangeEastern(event: {
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
}): string {
  if (event.isAllDay) {
    return `${formatEventDateEastern(event.startDate)} - All day`;
  }
  const startDate = formatEventDateEastern(event.startDate);
  const startTime = formatEventTimeEastern(event.startDate);
  const endTime = formatEventTimeEastern(event.endDate);
  return `${startDate}, ${startTime} – ${endTime} ET`;
}

export function getEasternCalendarBadge(date: Date): { month: string; day: number } {
  return {
    month: monthShortFmt.format(date),
    day: Number(dayNumFmt.format(date)),
  };
}

export function formatMonthNameLongEastern(date: Date): string {
  return monthLongFmt.format(date);
}

export function formatShortWeekdayEastern(date: Date): string {
  return shortWeekdayFmt.format(date);
}

export function formatWeekdayLongEastern(date: Date): string {
  return longWeekdayFmt.format(date);
}

/** Haystack fragments for search: Eastern calendar labels. */
export function formatDateForSearchEastern(d: Date): string {
  return [
    searchDateFmtLong.format(d),
    searchDateFmtShort.format(d),
    yearFmt.format(d),
  ].join(' ');
}

/**
 * Interpret `dateYmd` + `timeHm` as wall-clock in US Eastern and return the UTC instant.
 */
export function easternWallClockToUtc(dateYmd: string, timeHm: string): Date {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [h, min] = timeHm.split(':').map(Number);
  const lo = Date.UTC(y, mo - 1, d - 1, 0, 0, 0);
  const hi = Date.UTC(y, mo - 1, d + 2, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  for (let t = lo; t < hi; t += 60 * 1000) {
    const dt = new Date(t);
    const parts = Object.fromEntries(formatter.formatToParts(dt).map((p) => [p.type, p.value]));
    if (
      Number(parts.year) === y &&
      Number(parts.month) === mo &&
      Number(parts.day) === d &&
      Number(parts.hour) === h &&
      Number(parts.minute) === min
    ) {
      return dt;
    }
  }
  return new Date(Date.UTC(y, mo - 1, d, h, min));
}
