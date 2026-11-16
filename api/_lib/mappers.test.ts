import { describe, expect, it, vi, afterAll, afterEach, beforeAll } from 'vitest';
import { mapRecordToEvent } from './mappers';

// Railway runs the API in UTC. Pin it here so a developer's Eastern clock can't hide
// a parse that depends on the server's time zone.
let previousTz: string | undefined;
beforeAll(() => {
  previousTz = process.env.TZ;
  process.env.TZ = 'UTC';
});
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

function mapDates(fields: Record<string, unknown>) {
  return mapRecordToEvent({ id: 'rec', fields: { Title: 'Event', ...fields } });
}

describe('mapRecordToEvent Eastern wall-clock times', () => {
  it('reads a timed Start Date with no offset as Eastern (EST)', () => {
    // The scraper writes local Eastern time with no zone: 11:30 AM is 16:30 UTC in November.
    const event = mapDates({
      'Start Date': '2026-11-13T11:30:00',
      'End Date': '2026-11-13T13:00:00',
    });

    expect(event.startDate).toBe('2026-11-13T16:30:00.000Z');
    expect(event.endDate).toBe('2026-11-13T18:00:00.000Z');
  });

  it('reads a timed Start Date with no offset as Eastern (EDT)', () => {
    const event = mapDates({ 'Start Date': '2026-10-23T07:30:00' });

    expect(event.startDate).toBe('2026-10-23T11:30:00.000Z');
  });

  it('accepts minutes-only and space-separated wall times', () => {
    expect(mapDates({ 'Start Date': '2026-11-16T18:00' }).startDate).toBe('2026-11-16T23:00:00.000Z');
    expect(mapDates({ 'Start Date': '2026-11-16 18:00:00' }).startDate).toBe(
      '2026-11-16T23:00:00.000Z',
    );
  });

  it('keeps values that carry their own offset or Z', () => {
    expect(mapDates({ 'Start Date': '2026-11-12T08:00:00-05:00' }).startDate).toBe(
      '2026-11-12T13:00:00.000Z',
    );
    expect(mapDates({ 'Start Date': '2026-11-12T13:00:00.000Z' }).startDate).toBe(
      '2026-11-12T13:00:00.000Z',
    );
  });

  it('maps a date-only Start Date to Eastern midnight on either side of DST', () => {
    expect(mapDates({ 'Start Date': '2026-09-08' }).startDate).toBe('2026-09-08T04:00:00.000Z');
    expect(mapDates({ 'Start Date': '2026-11-12' }).startDate).toBe('2026-11-12T05:00:00.000Z');
  });

  it('resolves times on the November fall-back day', () => {
    // 1:30 AM happens twice; take the first (EDT). 6 PM is after the change (EST).
    expect(mapDates({ 'Start Date': '2026-11-01T01:30:00' }).startDate).toBe(
      '2026-11-01T05:30:00.000Z',
    );
    expect(mapDates({ 'Start Date': '2026-11-01T18:00:00' }).startDate).toBe(
      '2026-11-01T23:00:00.000Z',
    );
  });
});

describe('mapRecordToEvent all-day flag', () => {
  it('treats a date-only Start Date as all day even when All Day Event is unchecked', () => {
    // The scraper leaves the time off when the page gives none; showing 12:00 AM is wrong.
    const event = mapDates({
      'Start Date': '2026-11-12',
      'End Date': '2026-11-12T10:00:00',
      'All Day Event': false,
    });

    expect(event.isAllDay).toBe(true);
  });

  it('keeps a timed Start Date as not all day', () => {
    expect(mapDates({ 'Start Date': '2026-11-12T08:00:00', 'All Day Event': false }).isAllDay).toBe(
      false,
    );
  });

  it('keeps All Day Event when it is checked on a timed Start Date', () => {
    expect(mapDates({ 'Start Date': '2026-11-12T08:00:00', 'All Day Event': true }).isAllDay).toBe(
      true,
    );
  });
});

describe('mapRecordToEvent date mapping', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back blank End Date to Start Date (not wall-clock now)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));

    const event = mapRecordToEvent({
      id: 'rec1',
      fields: {
        'Event ID': 'evt-dec',
        Status: 'Approved',
        Title: 'Holiday Open Guide',
        'Start Date': '2025-12-22',
        // End Date intentionally omitted — Airtable often leaves this blank
      },
    });

    expect(event.startDate).toBe(event.endDate);
    expect(event.startDate.startsWith('2025-12-22')).toBe(true);
    expect(event.endDate.startsWith('2026-10-07')).toBe(false);
  });

  it('preserves an explicit End Date when present', () => {
    const event = mapRecordToEvent({
      id: 'rec2',
      fields: {
        'Event ID': 'evt-ok',
        Status: 'Approved',
        Title: 'Sound Bath',
        'Start Date': '2026-10-07T12:00:00.000Z',
        'End Date': '2026-10-07T13:00:00.000Z',
      },
    });

    expect(event.startDate).toBe('2026-10-07T12:00:00.000Z');
    expect(event.endDate).toBe('2026-10-07T13:00:00.000Z');
  });
});
