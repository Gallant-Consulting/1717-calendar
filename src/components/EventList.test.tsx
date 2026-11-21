import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Event } from '../types';
import { eventMatchesQuery } from '../utils/eventSearch';
import { EventList } from './EventList';

function mkEvent(
  partial: Pick<Event, 'id' | 'title' | 'startDate' | 'endDate'> & Partial<Event>,
): Event {
  return {
    isAllDay: false,
    ...partial,
  };
}

describe('EventList', () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders search input and raises search updates', () => {
    const events: Event[] = [
      mkEvent({
        id: 'e1',
        title: 'Marketing Workshop',
        startDate: new Date(2026, 5, 15, 9, 0),
        endDate: new Date(2026, 5, 15, 10, 30),
      }),
    ];
    const onSearchQueryChange = vi.fn();
    render(
      <EventList
        events={events}
        searchQuery=""
        onSearchQueryChange={onSearchQueryChange}
        hasMore={false}
        onLoadMore={vi.fn()}
        scrollContainerHeight="480px"
      />,
    );

    const input = screen.getByPlaceholderText(/search for an event/i);
    fireEvent.change(input, { target: { value: 'workshop' } });
    expect(onSearchQueryChange).toHaveBeenCalledWith('workshop');
  });

  it('renders only the passed visible events in a scrollable list', () => {
    const events: Event[] = [
      mkEvent({
        id: 'e1',
        title: 'Earlier',
        startDate: new Date(2026, 5, 15, 9, 0),
        endDate: new Date(2026, 5, 15, 10, 30),
      }),
      mkEvent({
        id: 'e2',
        title: 'Later',
        startDate: new Date(2026, 5, 16, 14, 0),
        endDate: new Date(2026, 5, 16, 15, 0),
      }),
    ];

    render(
      <div className="flex h-[480px] flex-col">
        <EventList
          events={[events[0]]}
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          hasMore={true}
          onLoadMore={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });

  it('renders multiple events when all are passed in', () => {
    const events: Event[] = [
      mkEvent({
        id: 'e1',
        title: 'Earlier',
        startDate: new Date(2026, 5, 15, 9, 0),
        endDate: new Date(2026, 5, 15, 10, 30),
      }),
      mkEvent({
        id: 'e2',
        title: 'Later',
        startDate: new Date(2026, 5, 16, 14, 0),
        endDate: new Date(2026, 5, 16, 15, 0),
      }),
    ];

    render(
      <div className="flex h-[480px] flex-col">
        <EventList
          events={events}
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          hasMore={false}
          onLoadMore={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
  });

  it('calls onLoadMore when manual load-more control is clicked', () => {
    const events: Event[] = [
      mkEvent({
        id: 'e1',
        title: 'Earlier',
        startDate: new Date(2026, 5, 15, 9, 0),
        endDate: new Date(2026, 5, 15, 10, 30),
      }),
    ];
    const onLoadMore = vi.fn();

    render(
      <div className="flex h-[480px] flex-col">
        <EventList
          events={events}
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          hasMore={true}
          onLoadMore={onLoadMore}
        />
      </div>,
    );

    const loadMoreButtons = screen.getAllByRole('button', { name: /load more events/i });
    fireEvent.click(loadMoreButtons[loadMoreButtons.length - 1]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('lists each day once with all of its events', () => {
    const events: Event[] = [
      // Noon and 2 PM Eastern on June 15, noon on June 16 (UTC instants so any test TZ agrees).
      mkEvent({ id: 'a', title: 'Coffee Connection', startDate: new Date('2026-06-15T16:00:00Z'), endDate: new Date('2026-06-15T17:00:00Z') }),
      mkEvent({ id: 'b', title: 'Job Fair', startDate: new Date('2026-06-15T18:00:00Z'), endDate: new Date('2026-06-15T20:00:00Z') }),
      mkEvent({ id: 'c', title: 'Fencing Demonstration', startDate: new Date('2026-06-16T16:00:00Z'), endDate: new Date('2026-06-16T17:00:00Z') }),
    ];

    render(
      <EventList events={events} searchQuery="" onSearchQueryChange={vi.fn()} hasMore={false} onLoadMore={vi.fn()} scrollContainerHeight="480px" />,
    );

    const days = screen.getAllByRole('group');
    expect(days.map((d) => d.getAttribute('aria-label'))).toEqual(['Monday, June 15', 'Tuesday, June 16']);
    expect(within(days[0]).getByText('Coffee Connection')).toBeInTheDocument();
    expect(within(days[0]).getByText('Job Fair')).toBeInTheDocument();
    expect(within(days[1]).getByText('Fencing Demonstration')).toBeInTheDocument();
    expect(within(days[0]).getAllByText('15')).toHaveLength(1);
  });

  it('narrows to matching events and their days when searching', () => {
    const events: Event[] = [
      mkEvent({ id: 'a', title: 'Coffee Connection', hostOrganization: 'Ashland', startDate: new Date('2026-06-15T16:00:00Z'), endDate: new Date('2026-06-15T17:00:00Z') }),
      mkEvent({ id: 'b', title: 'Job Fair', startDate: new Date('2026-06-15T18:00:00Z'), endDate: new Date('2026-06-15T20:00:00Z') }),
      mkEvent({ id: 'c', title: 'Fencing Demonstration', hostOrganization: 'Ashland', startDate: new Date('2026-06-16T16:00:00Z'), endDate: new Date('2026-06-16T17:00:00Z') }),
      mkEvent({ id: 'd', title: 'Walk-In Wednesdays', startDate: new Date('2026-06-17T14:00:00Z'), endDate: new Date('2026-06-17T16:00:00Z') }),
    ];
    const props = { onSearchQueryChange: vi.fn(), hasMore: false, onLoadMore: vi.fn(), scrollContainerHeight: '480px' };
    // App filters with eventMatchesQuery before handing events to the list; do the same here.
    const search = (q: string) => events.filter((e) => eventMatchesQuery(e, q));

    const { rerender } = render(<EventList events={events} searchQuery="" {...props} />);
    expect(screen.getAllByRole('group')).toHaveLength(3);

    rerender(<EventList events={search('ashland')} searchQuery="ashland" {...props} />);
    let days = screen.getAllByRole('group');
    expect(days.map((d) => d.getAttribute('aria-label'))).toEqual(['Monday, June 15', 'Tuesday, June 16']);
    expect(within(days[0]).getByText('Coffee Connection')).toBeInTheDocument();
    expect(screen.queryByText('Job Fair')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk-In Wednesdays')).not.toBeInTheDocument();
    expect(screen.getByText('2 events found')).toBeInTheDocument();

    rerender(<EventList events={search('fencing')} searchQuery="fencing" {...props} />);
    days = screen.getAllByRole('group');
    expect(days).toHaveLength(1);
    expect(days[0]).toHaveAttribute('aria-label', 'Tuesday, June 16');
    expect(screen.getByText('1 event found')).toBeInTheDocument();

    rerender(<EventList events={search('no such event')} searchQuery="no such event" {...props} />);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByText('No matching events found')).toBeInTheDocument();

    rerender(<EventList events={events} searchQuery="" {...props} />);
    expect(screen.getAllByRole('group')).toHaveLength(3);
  });

  it('labels the current day as Today', () => {
    const now = new Date();
    render(
      <EventList
        events={[mkEvent({ id: 't', title: 'Happening now', startDate: now, endDate: now })]}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        hasMore={false}
        onLoadMore={vi.fn()}
        scrollContainerHeight="480px"
      />,
    );
    expect(within(screen.getByRole('group')).getByText('Today')).toBeInTheDocument();
  });
});
