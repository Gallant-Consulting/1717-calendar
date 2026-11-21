import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { AgendaDay } from './AgendaDay';
import { cn } from './ui/utils';
import type { Event } from '../types';
import { easternDayKey, groupEventsByMonthAndDay } from '../utils/agendaGroups';

interface EventListProps {
  /** Already ordered and search-filtered; the list groups these by day and shows nothing else. */
  events: Event[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  hasMore: boolean;
  onLoadMore: () => void | Promise<void>;
  /** When true, infinite scroll / button avoid duplicate fetches. */
  loadingMore?: boolean;
  onTopVisibleMonthChange?: (month: Date) => void;
  /**
   * When false, the list does not report the top-visible month (skips jumping the calendar before an initial `scrollToDay`).
   * @default true
   */
  syncVisibleMonthToParent?: boolean;
  /** When set, constrains list height (e.g. tests). When omitted, list fills the parent flex column. */
  scrollContainerHeight?: string;
  /** When set, scrolls the list so the first event on this local calendar day is visible. */
  scrollToDay?: Date | null;
  onScrollToDayComplete?: () => void;
  /** Passed to `scrollInto` alignment; use `auto` for initial positioning so month sync is accurate. */
  scrollToDayBehavior?: ScrollBehavior;
}

/** Stable key for a calendar day in the user's local timezone. */
function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Scroll so `child` aligns to the top of `container`'s visible area — does not scroll the window. */
function scrollElementIntoContainer(
  container: HTMLElement,
  child: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  const cRect = container.getBoundingClientRect();
  const chRect = child.getBoundingClientRect();
  const nextTop = container.scrollTop + (chRect.top - cRect.top);
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

export function EventList({
  events,
  searchQuery,
  onSearchQueryChange,
  hasMore,
  onLoadMore,
  loadingMore = false,
  onTopVisibleMonthChange,
  syncVisibleMonthToParent = true,
  scrollContainerHeight,
  scrollToDay = null,
  onScrollToDayComplete,
  scrollToDayBehavior = 'smooth',
}: EventListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const monthHeaderRefs = useRef<Record<string, HTMLHeadingElement | null>>({});
  const dayAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [listScrollFooter, setListScrollFooter] = useState<{ scrollable: boolean; atBottom: boolean }>({
    scrollable: false,
    atBottom: false,
  });

  const syncListScrollFooter = useCallback(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const scrollable = scrollHeight > clientHeight + 2;
    const atBottom = scrollable && scrollTop + clientHeight >= scrollHeight - 8;
    setListScrollFooter((prev) =>
      prev.scrollable === scrollable && prev.atBottom === atBottom ? prev : { scrollable, atBottom },
    );
  }, []);

  const scrollListToTop = useCallback(() => {
    scrollRootRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const groupedEvents = useMemo(() => groupEventsByMonthAndDay(events), [events]);

  useEffect(() => {
    if (!hasMore || loadingMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          void onLoadMore();
        }
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    if (!onTopVisibleMonthChange || !syncVisibleMonthToParent || groupedEvents.length === 0) return;
    const root = scrollRootRef.current;
    if (!root) return;

    // The month whose section holds the list's top edge: the last heading at or above it.
    // (Nearest-heading-either-way picked the *next* month when its heading sat just below,
    // e.g. jumping to Nov 30 flipped the calendar to December.)
    const detectTopMonth = () => {
      const rootTop = root.getBoundingClientRect().top;
      let current: Date | null = null;

      for (const group of groupedEvents) {
        const heading = monthHeaderRefs.current[group.key];
        if (!heading) continue;
        if (current === null || heading.getBoundingClientRect().top <= rootTop + 8) {
          current = group.month;
        } else {
          break;
        }
      }

      if (current) {
        onTopVisibleMonthChange(current);
      }
    };

    // Only sync on scroll — an immediate detect at scrollTop=0 jumps the calendar to the
    // earliest loaded month (e.g. March) when the initial today-anchor is not on page 1.
    root.addEventListener('scroll', detectTopMonth);
    return () => root.removeEventListener('scroll', detectTopMonth);
  }, [groupedEvents, onTopVisibleMonthChange, syncVisibleMonthToParent]);

  useEffect(() => {
    if (groupedEvents.length === 0) return;
    const el = scrollRootRef.current;
    const content = scrollContentRef.current;
    if (!el) return;

    syncListScrollFooter();
    el.addEventListener('scroll', syncListScrollFooter, { passive: true });
    const ro = new ResizeObserver(() => syncListScrollFooter());
    ro.observe(el);
    if (content) ro.observe(content);

    return () => {
      el.removeEventListener('scroll', syncListScrollFooter);
      ro.disconnect();
    };
  }, [groupedEvents.length, events, syncListScrollFooter]);

  useLayoutEffect(() => {
    syncListScrollFooter();
  }, [groupedEvents, events, syncListScrollFooter]);

  useLayoutEffect(() => {
    if (!scrollToDay) return;
    const key = dayKeyLocal(scrollToDay);
    const tryScroll = () => {
      const container = scrollRootRef.current;
      const el = dayAnchorRefs.current[key];
      if (container && el) {
        scrollElementIntoContainer(container, el, scrollToDayBehavior);
        // Programmatic scroll may not fire a 'scroll' listener in all environments; sync month now.
        onScrollToDayComplete?.();
        return;
      }
      requestAnimationFrame(() => {
        const c = scrollRootRef.current;
        const el2 = dayAnchorRefs.current[key];
        if (c && el2) {
          scrollElementIntoContainer(c, el2, scrollToDayBehavior);
        }
        // Always complete so App can enable month sync; calendar stays on the pre-set activeMonth
        // until the user scrolls (no immediate top-month detect on enable).
        onScrollToDayComplete?.();
      });
    };
    tryScroll();
  }, [scrollToDay, events, onScrollToDayComplete, scrollToDayBehavior]);

  const searchHasValue = searchQuery.trim().length > 0;
  const todayKey = easternDayKey(new Date());

  const monthTitle = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const onInputChange = (value: string) => {
    onSearchQueryChange(value);
  };

  const emptyTitle = searchHasValue ? 'No matching events found' : 'No upcoming events';

  const fillParent = scrollContainerHeight === undefined;

  return (
    <div className={cn('w-full', fillParent && 'flex h-full min-h-0 flex-col')}>
      <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-input bg-card px-3 py-2 transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft" role="search">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id="event-list-search"
          value={searchQuery}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Search for an event or group"
          aria-label="Search for an event or group"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {searchHasValue ? (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="mb-3 shrink-0 text-right text-xs text-dimmed">
        {events.length} {events.length === 1 ? 'event' : 'events'}{searchHasValue ? ' found' : ''}
      </p>

      <div
        className={cn('flex min-h-0 flex-1 flex-col', !fillParent && 'min-h-[240px]')}
        style={scrollContainerHeight !== undefined ? { maxHeight: scrollContainerHeight } : undefined}
      >
        {groupedEvents.length > 0 ? (
          <>
            <div
              ref={scrollRootRef}
              className={cn(
                'min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain pr-2',
                'border-b border-border',
                fillParent && 'flex-1',
              )}
            >
              <div ref={scrollContentRef} className="space-y-6 pb-8">
                {groupedEvents.map((group) => (
                  <section key={group.key} data-month-key={group.key}>
                    <h3
                      ref={(node) => {
                        monthHeaderRefs.current[group.key] = node;
                      }}
                      className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-dimmed"
                    >
                      {monthTitle(group.month)}
                    </h3>
                    <div className="rounded-md border border-input bg-card">
                      {group.days.map((day) => {
                        // Calendar clicks arrive as a local day; anchor each day group under the
                        // local day of its first event (same as Eastern for Richmond viewers).
                        const anchorKey = dayKeyLocal(day.date);
                        return (
                          <AgendaDay
                            key={day.key}
                            day={day}
                            isToday={day.key === todayKey}
                            anchorRef={(el) => {
                              if (el) dayAnchorRefs.current[anchorKey] = el;
                              else delete dayAnchorRefs.current[anchorKey];
                            }}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            {listScrollFooter.scrollable ? (
              listScrollFooter.atBottom ? (
                <button
                  type="button"
                  onClick={scrollListToTop}
                  className="flex w-full shrink-0 items-center justify-center gap-1 pt-3 pb-2 text-center text-sm text-muted-foreground underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/30"
                >
                  Return to top
                  <ChevronUp className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.5} aria-hidden />
                </button>
              ) : (
                <p className="flex shrink-0 items-center justify-center gap-1 pt-3 pb-2 text-center text-sm text-muted-foreground">
                  Scroll for more
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.5} aria-hidden />
                </p>
              )
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {emptyTitle}
          </div>
        )}

        {hasMore ? (
          <div className="mt-4 flex shrink-0 flex-col items-center gap-3 pb-1">
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void onLoadMore()}
              className="rounded-md border border-input bg-card px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more events'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
