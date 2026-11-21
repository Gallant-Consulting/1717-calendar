import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import type { Event } from '../types';

interface CalendarProps {
  events: Event[];
  displayMonth?: Date;
  onDisplayMonthChange?: (month: Date) => void;
  /** When set, days that have events become clickable to focus that day in the event list. */
  onDayWithEventsClick?: (date: Date) => void;
}

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function Calendar({ events, displayMonth, onDisplayMonthChange, onDayWithEventsClick }: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() => monthStart(new Date()));
  const activeMonth = displayMonth ? monthStart(displayMonth) : internalMonth;

  /** Events per local calendar day in the active month. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of events) {
      const date = new Date(event.startDate);
      if (date.getFullYear() !== activeMonth.getFullYear() || date.getMonth() !== activeMonth.getMonth()) {
        continue;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }
    return map;
  }, [events, activeMonth]);

  const updateMonth = (nextMonth: Date) => {
    if (!displayMonth) {
      setInternalMonth(nextMonth);
    }
    onDisplayMonthChange?.(nextMonth);
  };

  const goPrev = () => {
    updateMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1));
  };

  const goNext = () => {
    updateMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1));
  };

  const firstDay = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate();
  const today = new Date();

  const isViewingCurrentMonth =
    activeMonth.getFullYear() === today.getFullYear() && activeMonth.getMonth() === today.getMonth();

  const goToToday = () => {
    updateMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="mb-4 grid grid-cols-[minmax(0,auto)_1fr_minmax(0,auto)] items-center gap-x-2">
        <Button
          aria-label="Previous month"
          variant="ghost"
          size="icon"
          className="shrink-0 text-primary hover:bg-primary-soft hover:text-primary"
          onClick={goPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="min-w-0 text-center font-headline text-xl font-bold tracking-[-0.01em] text-ink">
          {activeMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <Button
          aria-label="Next month"
          variant="ghost"
          size="icon"
          className="shrink-0 justify-self-end text-primary hover:bg-primary-soft hover:text-primary"
          onClick={goNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="grid grid-cols-7 gap-y-1 text-center text-[10.5px] font-bold uppercase tracking-[0.12em] text-dimmed"
      >
        {WEEK_DAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: firstDay }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-10" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), day);
          const key = `${date.getFullYear()}-${date.getMonth()}-${day}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const count = dayEvents.length;
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();

          const dayLabel = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });

          const visibleDots = dayEvents.slice(0, 3);
          const hasOverflow = dayEvents.length > 3;

          const dots = (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0.5 left-1/2 flex max-w-[calc(100%-2px)] -translate-x-1/2 items-center justify-center gap-0.5"
            >
              {visibleDots.map((ev) => (
                <span
                  key={ev.id}
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${isToday ? 'bg-primary' : 'bg-toned'}`}
                />
              ))}
              {hasOverflow && (
                <span className="text-[8px] font-bold leading-none text-muted-foreground">+</span>
              )}
            </span>
          );

          return (
            <div key={day} className="relative h-10">
              {count > 0 && onDayWithEventsClick ? (
                <button
                  type="button"
                  onClick={() => onDayWithEventsClick(date)}
                  aria-label={`${dayLabel}, ${count} event${count === 1 ? '' : 's'}. Show in list.`}
                  className={`relative flex h-full w-full items-center justify-center rounded text-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                    isToday ? 'bg-primary-soft font-bold text-primary' : 'font-medium text-foreground'
                  }`}
                >
                  {day}
                  {dots}
                </button>
              ) : (
                <div
                  className={`relative flex h-full items-center justify-center rounded text-sm ${
                    isToday ? 'bg-primary-soft font-bold text-primary' : 'text-dimmed'
                  }`}
                >
                  {day}
                  {count > 0 ? dots : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isViewingCurrentMonth ? (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" size="sm" className="px-4 text-xs font-medium" onClick={goToToday}>
            Today
          </Button>
        </div>
      ) : null}
    </div>
  );
}
