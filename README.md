# Shared Calendar — Central VA Events

Live at **[calendar.goodcompanyva.org](https://calendar.goodcompanyva.org/)** for [Good Company](https://goodcompanyva.org/) (formerly 1717 Collective). Old hosts redirect there (`api/_lib/canonicalHost.ts`).

A **read-focused** event calendar for the Central Virginia startup ecosystem: **month grid** + **scrollable schedule list**, backed by **Airtable** through a **same-origin `/api/events`** proxy (secrets never ship to the browser).

**UI (main app):** Viewport-locked layout; list search; **Load more** fetches the next server page; calendar dots match list **accent colors**; titles link out when an event URL exists; **Hosted by** uses `host_name` / Host Group; images from URL or attachment fields. **Times** display in **US Eastern** (`America/New_York`).

**API:** `GET /api/events` returns `{ events, nextOffset }`. The server filters **approved** rows and **`End Date` ≥ today − 30 days** (Airtable `TODAY()` / base timezone), sorts by **Start Date**, paginates (**limit** ≤ 100). Client search only covers **already loaded** pages until you load more.

## Tech

React 19, TypeScript, Vite 7, Tailwind + shadcn/ui, Vitest.

## Run locally

```bash
cp env.example .env   # set AIRTABLE_PAT, AIRTABLE_BASE_ID
npm install
npm run dev           # http://localhost:5173 — Vite dev server + /api/events middleware
```

## Production

Static hosting alone **cannot** serve JSON for `/api/events` (you get HTML → parse errors). Use **Node**:

```bash
npm run build
npm start             # tsx server.ts — dist/ + /api/events + GET /health
```

Set **`AIRTABLE_PAT`**, **`AIRTABLE_BASE_ID`**, and **`PORT`** (or let the host inject it). Optional **`VITE_API_BASE_URL`** if the API lives on another origin.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev + API middleware |
| `npm run build` | `tsc` + Vite build |
| `npm start` | **Use in prod** — static + API |
| `npm run preview` | Static preview only (**no** API) |
| `npm test` | Vitest |

## Env

| Variable | Role |
|----------|------|
| `AIRTABLE_PAT` | Server only |
| `AIRTABLE_BASE_ID` | Server only |
| `VITE_API_BASE_URL` | Optional; prefix for `/api` in the browser |
| `PORT` | `npm start` (default `4173`) |

## Layout

```
src/App.tsx, components/ (Calendar, EventList, ScheduleEventCard, …)
src/services/eventsApi.ts   → fetch /api/events
api/events.ts               → Airtable list + CRUD
api/_lib/airtable.ts, mappers.ts, nodeHttpAdapter.ts
server.ts                   → production HTTP entry
```

Event model and Eastern helpers: `src/types.ts`, `src/utils/eventTime.ts`. Architecture notes: `DECISION_LOG.md`.

## Related

- [Attributions.md](Attributions.md) — credits
