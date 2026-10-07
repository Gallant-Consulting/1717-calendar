import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickInitialListScrollDay } from './initialListScroll';

describe('pickInitialListScrollDay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for an empty list', () => {
    expect(pickInitialListScrollDay([], new Date(2026, 3, 6))).toBeNull();
  });

  it('prefers the first event whose local start day is on or after today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 6, 12, 0, 0)); // Apr 6 local

    const day = pickInitialListScrollDay(
      [
        {
          startDate: new Date(2026, 3, 1, 10, 0),
          endDate: new Date(2026, 3, 1, 11, 0),
        },
        {
          startDate: new Date(2026, 3, 8, 9, 0),
          endDate: new Date(2026, 3, 8, 10, 0),
        },
      ],
      new Date(),
    );

    expect(day).toEqual(new Date(2026, 3, 8));
  });

  it('anchors on today when an ongoing event started before today (not the event start month)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 6, 12, 0, 0));

    const day = pickInitialListScrollDay(
      [
        {
          startDate: new Date(2026, 3, 4, 10, 0),
          endDate: new Date(2026, 3, 10, 18, 0),
        },
      ],
      new Date(),
    );

    expect(day).toEqual(new Date(2026, 3, 6));
  });

  it('does not jump to March for a year-long ongoing event when today is in October', () => {
    // Production page-1 shape: long-running rows sort first by Start Date; none start on/after today.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0)); // Oct 7 local

    const day = pickInitialListScrollDay(
      [
        {
          startDate: new Date(2026, 2, 12, 0, 0),
          endDate: new Date(2027, 2, 12, 0, 0),
        },
        {
          startDate: new Date(2026, 5, 27, 0, 0),
          endDate: new Date(2027, 5, 27, 0, 0),
        },
      ],
      new Date(),
    );

    expect(day).toEqual(new Date(2026, 9, 7));
  });

  it('falls back to the first event when nothing is ongoing or future-starting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 6, 12, 0, 0));

    const day = pickInitialListScrollDay(
      [
        {
          startDate: new Date(2026, 2, 1, 10, 0),
          endDate: new Date(2026, 2, 1, 11, 0),
        },
      ],
      new Date(),
    );

    expect(day).toEqual(new Date(2026, 2, 1));
  });

  it('does not treat a past December start as ongoing when end equals start (blank-end fallback)', () => {
    // Regression: mapping blank End Date → now made Dec rows look ongoing and anchored the UI there.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0)); // Oct 7 local

    const decemberStart = new Date(2025, 11, 22, 10, 0);
    const day = pickInitialListScrollDay(
      [
        {
          startDate: decemberStart,
          endDate: decemberStart,
        },
        {
          startDate: new Date(2026, 9, 7, 12, 0),
          endDate: new Date(2026, 9, 7, 13, 0),
        },
      ],
      new Date(),
    );

    expect(day).toEqual(new Date(2026, 9, 7));
  });
});
