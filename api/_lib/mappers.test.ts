import { describe, expect, it, vi, afterEach } from 'vitest';
import { mapRecordToEvent } from './mappers';

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
