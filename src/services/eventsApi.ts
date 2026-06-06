import type { Event } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const EVENTS_API_PATH = `${API_BASE}/api/events`;

type EventDto = {
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

function toDate(input?: string): Date {
  if (!input) return new Date();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapDtoToEvent(dto: EventDto): Event {
  return {
    id: dto.id,
    title: dto.title,
    startDate: toDate(dto.startDate),
    endDate: toDate(dto.endDate),
    isAllDay: Boolean(dto.isAllDay),
    link: dto.link,
    notes: dto.notes,
    hostOrganization: dto.hostOrganization,
    location: dto.location,
    imageUrl: dto.imageUrl,
  };
}

function mapEventToDto(event: Partial<Event>): EventDto {
  const generatedId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return {
    id: event.id ?? generatedId,
    title: event.title ?? '',
    startDate: event.startDate ? new Date(event.startDate).toISOString() : new Date().toISOString(),
    endDate: event.endDate ? new Date(event.endDate).toISOString() : new Date().toISOString(),
    isAllDay: Boolean(event.isAllDay),
    link: event.link,
    notes: event.notes,
    hostOrganization: event.hostOrganization,
    location: event.location,
    imageUrl: event.imageUrl,
  };
}

function looksLikeJsonPayload(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }
  const ct = response.headers.get('content-type') ?? '';
  const jsonByHeader = ct.includes('application/json') || ct.includes('text/json');
  if (!jsonByHeader && !looksLikeJsonPayload(text)) {
    throw new Error("Database can't be reached.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Database can't be reached.");
  }
}

type EventsPageDto = {
  events: EventDto[];
  nextOffset: string | null;
};

function buildEventsGetUrl(params?: { limit?: number; offset?: string }): string {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set('limit', String(params.limit));
  }
  if (params?.offset) {
    search.set('offset', params.offset);
  }
  const q = search.toString();
  return q ? `${EVENTS_API_PATH}?${q}` : EVENTS_API_PATH;
}

/** One page of events from GET /api/events (server applies 30-day + approved filter). */
export async function getEventsPage(params?: {
  limit?: number;
  offset?: string;
}): Promise<{ events: Event[]; nextOffset: string | null }> {
  const response = await fetch(buildEventsGetUrl(params));
  const payload = await parseResponse<EventsPageDto>(response);
  if (!payload || !Array.isArray(payload.events)) {
    throw new Error("Database can't be reached.");
  }
  return {
    events: payload.events.map(mapDtoToEvent),
    nextOffset: payload.nextOffset ?? null,
  };
}

/** Fetches every page until exhausted (use sparingly; prefer getEventsPage for lazy UI). */
export async function getEvents(): Promise<Event[]> {
  const out: Event[] = [];
  let offset: string | undefined;
  do {
    const { events, nextOffset } = await getEventsPage({ limit: 100, offset });
    out.push(...events);
    offset = nextOffset ?? undefined;
  } while (offset);
  return out;
}

export async function addEvent(event: Omit<Event, 'id'>): Promise<Event> {
  const dto = mapEventToDto(event);
  const response = await fetch(EVENTS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const payload = await parseResponse<EventDto>(response);
  return mapDtoToEvent(payload);
}

export async function updateEvent(event: Event): Promise<Event> {
  const dto = mapEventToDto(event);
  const response = await fetch(EVENTS_API_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const payload = await parseResponse<EventDto>(response);
  return mapDtoToEvent(payload);
}

export async function deleteEvent(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${EVENTS_API_PATH}?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return parseResponse<{ success: boolean }>(response);
}
