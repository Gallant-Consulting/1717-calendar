import { createRecord, deleteRecord, listRecords, listRecordsPage, updateRecord } from './_lib/airtable';
import {
  isApprovedStatus,
  mapEventToCreateFields,
  mapEventToUpdateFields,
  mapRecordToEvent,
  TABLES,
  type EventPayload,
} from './_lib/mappers';

/** Approved + End Date within last 30 days through future (Airtable base timezone / TODAY()). */
export const EVENTS_LIST_FILTER_FORMULA =
  "AND(OR(LOWER(TRIM({Status}&''))='approved', LOWER(TRIM({Status}&''))='apporoved'), NOT(IS_BEFORE({End Date}, DATEADD(TODAY(), -30, 'days'))))";

const MAX_EVENTS_PAGE = 100;
const DEFAULT_EVENTS_PAGE = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function text(message: string, status = 400): Response {
  return new Response(message, { status });
}

async function findByEventId(eventId: string) {
  const escaped = eventId.replace(/'/g, "\\'");
  const records = await listRecords(TABLES.EVENTS_TABLE, {
    filterByFormula: `{Event ID}='${escaped}'`,
    maxRecords: 1,
  });
  return records[0] || null;
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limitRaw = url.searchParams.get('limit');
      const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_EVENTS_PAGE;
      const pageSize =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.floor(parsedLimit), MAX_EVENTS_PAGE)
          : DEFAULT_EVENTS_PAGE;
      const offset = url.searchParams.get('offset') ?? undefined;

      const { records, nextOffset } = await listRecordsPage(TABLES.EVENTS_TABLE, {
        filterByFormula: EVENTS_LIST_FILTER_FORMULA,
        pageSize,
        offset,
        sort: [{ field: 'Start Date', direction: 'asc' }],
      });

      const payload = records
        .filter((record) => isApprovedStatus(record.fields.Status))
        .map((record) => mapRecordToEvent(record));

      return json({
        events: payload,
        nextOffset: nextOffset ?? null,
      });
    }

    if (request.method === 'POST') {
      const incoming = (await request.json()) as Partial<EventPayload>;
      const created = await createRecord(TABLES.EVENTS_TABLE, mapEventToCreateFields(incoming));
      return json(mapRecordToEvent(created));
    }

    if (request.method === 'PUT') {
      const incoming = (await request.json()) as Partial<EventPayload>;
      if (!incoming.id) return text('Missing event id', 400);

      const record = await findByEventId(incoming.id);
      if (!record) return text('Event not found', 404);

      const updated = await updateRecord(TABLES.EVENTS_TABLE, record.id, mapEventToUpdateFields(incoming));
      return json(mapRecordToEvent(updated));
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const eventId = url.searchParams.get('id');
      if (!eventId) return text('Missing event id', 400);

      const record = await findByEventId(eventId);
      if (!record) return text('Event not found', 404);

      await deleteRecord(TABLES.EVENTS_TABLE, record.id);
      return json({ success: true });
    }

    return text('Method not allowed', 405);
  } catch (error) {
    // Log the real error server-side but return a generic message to the client
    console.error('[events handler]', error);
    const message =
      error instanceof Error && error.message.startsWith('Database')
        ? error.message
        : "Database can't be reached.";
    return text(message, 500);
  }
}
