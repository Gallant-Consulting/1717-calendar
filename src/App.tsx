import './styles/globals.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from './components/Calendar';
import { EventList } from './components/EventList';
import { EventModal } from './components/EventModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import type { Event } from './types';
import {
  getEventsPage,
  addEvent as apiAddEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
} from './services/eventsApi';
import { eventMatchesQuery } from './utils/eventSearch';
import { pickInitialListScrollDay } from './utils/initialListScroll';
import { SCHEDULE_PRIMARY_ACCENT } from './utils/scheduleAccent';
import { FOOTER_LINKS, SUBSCRIBE_WEBHOOK_URL } from './siteConfig';
import { EmailSignup } from './components/EmailSignup';

// Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error?: Error}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // console.error('EventModal Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Error in EventModal</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>There was an error rendering the EventModal:</p>
              <pre className="text-sm bg-muted p-2 rounded mt-2 overflow-auto">
                {this.state.error?.message}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventsNextOffset, setEventsNextOffset] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreInFlight = useRef(false);
  const [activeMonth, setActiveMonth] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [scrollToDay, setScrollToDay] = useState<Date | null>(null);
  /** False until initial list scroll (or no-op) finishes so the calendar is not driven by scrollTop=0 month. */
  const [listScrollSyncsCalendarMonth, setListScrollSyncsCalendarMonth] = useState(false);
  const [scrollToDayBehavior, setScrollToDayBehavior] = useState<ScrollBehavior>('auto');
  const initialListAnchorAppliedRef = useRef(false);

  // Handle browser back/forward: clear edit modal when `event` query is removed from the URL.
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('event');

      if (!eventId) {
        setIsEventModalOpen(false);
        setEditingEvent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // First page of events (server: approved + End Date within ~30 days; paginated)
  useEffect(() => {
    setLoading(true);
    setError(null);
    setEventsNextOffset(null);
    getEventsPage()
      .then(({ events: firstPage, nextOffset }) => {
        setEvents(firstPage);
        setEventsNextOffset(nextOffset);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load events');
        setEvents([]);
        setEventsNextOffset(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const future = events.filter((event) => event.endDate >= todayStart);
    const base = future.length > 0 ? future : events;
    return [...base].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return upcomingEvents;
    return events
      .filter((event) => eventMatchesQuery(event, searchQuery))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events, upcomingEvents, searchQuery]);

  useEffect(() => {
    if (loading || initialListAnchorAppliedRef.current) return;
    initialListAnchorAppliedRef.current = true;

    if (searchQuery.trim()) {
      setListScrollSyncsCalendarMonth(true);
      return;
    }

    const day = pickInitialListScrollDay(filteredEvents, new Date());
    if (!day) {
      setListScrollSyncsCalendarMonth(true);
      return;
    }

    setScrollToDay(day);
  }, [loading, filteredEvents, searchQuery]);

  const hasMore = Boolean(eventsNextOffset);

  const handleSaveEvent = async (eventData: Omit<Event, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      if (editingEvent) {
        // Update
        const updated = await apiUpdateEvent({ ...eventData, id: editingEvent.id });
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? updated : e));
      } else {
        // Add
        const added = await apiAddEvent(eventData);
        setEvents(prev => [...prev, added]);
      }
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setSelectedDate(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save event';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiDeleteEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setIsEventModalOpen(false);
      setEditingEvent(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete event';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseEventModal = () => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setSelectedDate(null);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('event');
    window.history.replaceState({}, '', newUrl.toString());
  };

  const currentYear = new Date().getFullYear();

  const shouldHideFooterLink = (text: string) => {
    const normalized = text.trim().toLowerCase();
    return (
      normalized === 'terms of service' ||
      normalized === 'privacy policy' ||
      normalized === 'cookie policy' ||
      normalized === 'tos' ||
      normalized === 'privacy' ||
      normalized === 'cookie'
    );
  };

  const visibleFooterLinks = FOOTER_LINKS.filter((link) => !shouldHideFooterLink(link.text));

  const handleLoadMore = useCallback(async () => {
    if (!eventsNextOffset || loadMoreInFlight.current) return;
    loadMoreInFlight.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const { events: more, nextOffset } = await getEventsPage({ offset: eventsNextOffset });
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const added = more.filter((e) => !seen.has(e.id));
        return [...prev, ...added];
      });
      setEventsNextOffset(nextOffset);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load more events';
      setError(message);
    } finally {
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }, [eventsNextOffset]);

  const handleTopVisibleMonthChange = useCallback((month: Date) => {
    setActiveMonth(new Date(month.getFullYear(), month.getMonth(), 1));
  }, []);

  const handleCalendarMonthChange = useCallback((month: Date) => {
    setActiveMonth(new Date(month.getFullYear(), month.getMonth(), 1));
  }, []);

  const handleScrollToDayComplete = useCallback(() => {
    setScrollToDay(null);
    setListScrollSyncsCalendarMonth(true);
    setScrollToDayBehavior('smooth');
  }, []);

  const handleCalendarDayWithEventsClick = (date: Date) => {
    const idx = filteredEvents.findIndex(
      (e) =>
        e.startDate.getFullYear() === date.getFullYear() &&
        e.startDate.getMonth() === date.getMonth() &&
        e.startDate.getDate() === date.getDate(),
    );
    if (idx < 0) return;
    setScrollToDay(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground geometric-bg">
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded shadow z-50">
          {error}
        </div>
      )}
      {/* Loading Spinner */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/10 z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-8 pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-6 pb-2 pt-2">
          <div className="mb-4 shrink-0">
            <h1 className="text-4xl font-semibold tracking-tight">
              Greater Richmond Business{' '}
              <span style={{ color: SCHEDULE_PRIMARY_ACCENT }}>Events</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Provided by the{' '}
              <a
                href="https://www.1717collective.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
                style={{ color: '#7d3cff' }}
              >
                1717 Collective
              </a>
            </p>
          </div>

          {/* Mobile: header → search/list → email → footer. Desktop: calendar + email | list. */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:overflow-hidden">
            <aside className="hidden w-full min-w-0 shrink-0 flex-col gap-0 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-1 lg:flex lg:max-w-[300px] lg:self-start">
              <Calendar
                events={filteredEvents}
                displayMonth={activeMonth}
                onDisplayMonthChange={handleCalendarMonthChange}
                onDayWithEventsClick={handleCalendarDayWithEventsClick}
              />
              <EmailSignup webhookUrl={SUBSCRIBE_WEBHOOK_URL} className="mt-4" />
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:col-start-2 lg:row-start-1 lg:h-full lg:min-h-0 lg:pt-[14px]">
              <EventList
                events={filteredEvents}
                accentSourceEvents={filteredEvents}
                loadingMore={loadingMore}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onTopVisibleMonthChange={handleTopVisibleMonthChange}
                syncVisibleMonthToParent={listScrollSyncsCalendarMonth}
                scrollToDay={scrollToDay}
                scrollToDayBehavior={scrollToDayBehavior}
                onScrollToDayComplete={handleScrollToDayComplete}
              />
            </div>

            <div className="shrink-0 lg:hidden">
              <EmailSignup webhookUrl={SUBSCRIBE_WEBHOOK_URL} className="mt-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section - Below main content */}
      <div className="shrink-0 py-4 text-center">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Powered by{' '}
              <a href="https://workgallantly.com" className="text-blue-400 hover:text-blue-300 underline transition-colors" target="_blank" rel="noopener noreferrer">Gallant</a>
              &nbsp;&copy; {currentYear}
              
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {visibleFooterLinks.map((link, index) => (
              <a 
                key={index}
                href={link.url} 
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.text}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Event Edit/Create Modal with Error Boundary */}
      <ErrorBoundary>
        <EventModal
          isOpen={isEventModalOpen}
          onClose={handleCloseEventModal}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : undefined}
          initialData={editingEvent}
          selectedDate={selectedDate}
        />
      </ErrorBoundary>
    </div>
  );
}
