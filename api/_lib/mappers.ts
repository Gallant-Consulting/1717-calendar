const EVENTS_TABLE = 'Events';

export const TABLES = {
  EVENTS_TABLE,
};

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

export type EventPayload = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  link?: string;
  notes?: string;
  hostOrganization?: string;
  location?: string;
  imageUrl?: string;
};

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function buildEventRecordFields(event: Partial<EventPayload>): Record<string, unknown> {
  return {
    'Event ID': event.id,
    Status: 'Pending',
    Title: event.title ?? '',
    'Start Date': event.startDate ?? '',
    'End Date': event.endDate ?? '',
    'All Day Event': Boolean(event.isAllDay),
    Location: event.location ?? '',
    Notes: event.notes ?? '',
    'Event URL': event.link ?? '',
  };
}

const EASTERN_TZ = 'America/New_York';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A date and time with no `Z` or offset, as the scraper writes local Eastern times. */
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

const easternParts = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** How far Eastern clocks are from UTC at this instant, in ms (e.g. −5h in EST). */
function easternOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    easternParts.formatToParts(new Date(instant)).map((p): [string, number] => [p.type, Number(p.value)]),
  );
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
  return wallAsUtc - instant;
}

type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * The UTC instant for a wall-clock time in US Eastern, on either side of DST.
 * The offset is read once at a guess and again at the result, so a time just past
 * a DST change uses the offset in force then.
 */
function utcIsoForEasternWallTime(wall: WallTime): string {
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const guess = wallAsUtc - easternOffsetMs(wallAsUtc);
  return new Date(wallAsUtc - easternOffsetMs(guess)).toISOString();
}

/**
 * ISO string, or null when blank/invalid. Airtable holds Eastern time with no offset:
 * date-only values are Eastern midnight, timed values are that Eastern wall time.
 * Values with `Z` or an offset are already instants and pass through.
 */
function parseIsoDate(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const dateOnly = DATE_ONLY.exec(trimmed);
    if (dateOnly) {
      const [, y, mo, d] = dateOnly.map(Number);
      return utcIsoForEasternWallTime({ year: y, month: mo, day: d, hour: 0, minute: 0, second: 0 });
    }
    const wall = WALL_TIME.exec(trimmed);
    if (wall) {
      const [, y, mo, d, h, mi, s] = wall.map((part) => Number(part ?? 0));
      return utcIsoForEasternWallTime({ year: y, month: mo, day: d, hour: h, minute: mi, second: s });
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString();
  }
  return null;
}

/** First attachment URL from an Airtable attachments field, or undefined. */
function firstAttachmentUrl(value: unknown): string | undefined {
  if (value == null || !Array.isArray(value) || value.length === 0) return undefined;
  const first = value[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    'url' in first &&
    typeof (first as { url: string }).url === 'string'
  ) {
    return (first as { url: string }).url;
  }
  return undefined;
}

/** Plain https URL stored as text (e.g. long-form URL field), or undefined. */
function trimmedHttpsUrl(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim() : asString(value).trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return s;
}

/**
 * Airtable image fields may be: plain URL text, or attachment array with `{ url }`.
 * Tries URL string first, then attachment shape.
 */
function imageUrlFromFieldValue(value: unknown): string | undefined {
  const direct = trimmedHttpsUrl(value);
  if (direct) return direct;
  return firstAttachmentUrl(value);
}

/** Prefer Image URL, then Image / Flyer / Cover Image (text URL or attachments). */
function imageUrlFromFields(fields: Record<string, unknown>): string | undefined {
  return (
    trimmedHttpsUrl(fields['Image URL']) ??
    imageUrlFromFieldValue(fields['Image']) ??
    imageUrlFromFieldValue(fields['Flyer']) ??
    imageUrlFromFieldValue(fields['Cover Image'])
  );
}

export function isApprovedStatus(status: unknown): boolean {
  const normalized = asString(status).trim().toLowerCase();
  return normalized === 'approved' || normalized === 'apporoved';
}

export function mapRecordToEvent(record: AirtableRecord): EventPayload {
  const fields = record.fields;

  const eventId = asString(fields['Event ID']) || record.id;
  // Never invent "now" for a missing date — that made blank End Dates look ongoing forever,
  // so pickInitialListScrollDay / calendar month sync jumped to the earliest loaded month (e.g. December).
  const startDate = parseIsoDate(fields['Start Date']) ?? new Date().toISOString();
  const endDate = parseIsoDate(fields['End Date']) ?? startDate;
  return {
    id: eventId,
    title: asString(fields.Title),
    startDate,
    endDate,
    isAllDay: Boolean(fields['All Day Event']),
    link: asString(fields['Event URL']) || asString(fields['Payment Link']) || undefined,
    notes: asString(fields.Notes) || undefined,
    hostOrganization:
      asString(fields['host_name']).trim() ||
      asString(fields['Host Group']).trim() ||
      undefined,
    location: asString(fields.Location) || undefined,
    imageUrl: imageUrlFromFields(fields),
  };
}

export function mapEventToCreateFields(event: Partial<EventPayload>): Record<string, unknown> {
  return buildEventRecordFields(event);
}

export function mapEventToUpdateFields(event: Partial<EventPayload>): Record<string, unknown> {
  const fields = buildEventRecordFields(event);
  delete fields['Event ID'];
  return fields;
}
