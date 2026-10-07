# Decision Log

## 2026-10-07 - Prefetch + reorder so the event list opens near today

### Context
PR #4 fixed the left calendar month, but the **list** still opened on **MARCH 2026** (Food Distribution, then June…). API pages sort by Start Date ascending, so page 1 is year-long past-start rows; `scrollToDay(today)` had no day anchor on page 1 and left `scrollTop=0` on March headers.

### Decision
- **`orderEventsForScheduleList`**: show starts on/after today first, then past-start ongoing rows.
- **Initial fetch in `App`**: keep requesting `getEventsPage` while `shouldPrefetchMoreForTodayAnchor` (has more pages and no loaded start on/after today), under the loading spinner, then apply `pickInitialListScrollDay` / `scrollToDay`.

### Tradeoffs
- First paint waits for enough pages to include a today-or-future start (often 2–3 pages with current Airtable data).
- Year-long programs still appear, but **after** upcoming starts—not at the top.

---

## 2026-10-07 - Initial anchor uses today for ongoing long-running events (March bug)

### Context
After blank-End-Date handling, production page 1 led with year-long approved rows (e.g. Food Distribution `2026-03-12` → `2027-03-12`). No loaded row started on/after today, so `pickInitialListScrollDay` used the first **ongoing** event’s **start day** → calendar synced to **March 2026**. Enabling list→calendar month sync then immediately called `detectTopMonth` at `scrollTop=0`, reinforcing the earliest month.

### Decision
- **`pickInitialListScrollDay`**: if nothing starts on/after today but something is still ongoing (`endDate >= today`), return **today**, not the ongoing event’s start.
- **`App`**: set `activeMonth` from the picked day before `scrollToDay`.
- **`EventList`**: when month sync turns on, listen for **scroll** only — do not run an immediate top-month detect (avoids jumping to page-1’s earliest month when today’s anchor is not rendered yet).

### Tradeoffs
- List may still show March+ year-long cards at the top until the user scrolls or loads more; the **calendar** stays on the current month.
- Multi-day events that started earlier no longer scroll the list to their first day on load (today is preferred).

---

## 2026-10-07 - Blank End Date must not become “now” (December calendar default)

### Context
Production loaded the month calendar on **December 2025** instead of the current month. `GET /api/events` page 1 was dominated by approved rows with **blank End Date** (starts back to 2025-12). Airtable’s `IS_BEFORE({End Date}, …)` is false for blanks, so `NOT(IS_BEFORE(...))` kept those rows in the 30-day window. The mapper then set missing End Date to **`new Date().toISOString()`**, so every blank-end row looked **ongoing**. `pickInitialListScrollDay` therefore anchored the list (and synced `activeMonth`) to the earliest start — December.

### Decision
- **`mapRecordToEvent`**: blank/invalid End Date falls back to **Start Date**, never wall-clock now (Start Date still falls back to now only if both are missing).
- **`EVENTS_LIST_FILTER_FORMULA`**: use `IF({End Date}, {End Date}, {Start Date})` inside the 30-day `IS_BEFORE` check so blank ends are gated by Start Date.

### Tradeoffs
- Open-ended Airtable rows without an End Date only stay in the feed while their **Start Date** is within the window (same as a same-day event). Operators who need long-running items must set a real End Date.
- Client scroll/sync logic unchanged; fixing bad effective end dates is enough for “today” anchoring.

---

## 2026-09-20 - Subscribe webhook points at the canonical n8n host

### Context
`SUBSCRIBE_WEBHOOK_URL` defaulted to `https://primary-production-9195.up.railway.app/webhook/subscribe`, the Railway-generated domain from before n8n moved to `https://n8n.workgallantly.com`. Both hosts still front the same instance today, so signups worked — but the generated domain is incidental, and if it is ever released the signup form breaks silently: the form posts, the request fails, and nothing surfaces anywhere.

Verified 2026-09-20 that both hosts answer `/webhook/subscribe` identically.

### Decision
- Default to **`https://n8n.workgallantly.com/webhook/subscribe`** in `src/siteConfig.ts`, with `VITE_SUBSCRIBE_WEBHOOK_URL` still available for staging.
- Update `env.example` and the `EmailSignup` test fixture so no reference to the generated domain remains in the repo.

### Tradeoffs
- Anything still calling the old host keeps working; this only changes what a fresh build ships.
- The unsubscribe link is built n8n-side in `1717 Calendar - Weekly Email`, not here, so it is updated separately in that workflow.

---

## 2026-09-20 - Fix `/api/events` pagination: `pageSize`, not `maxRecords`

### Context
The published calendar showed no events after 2026-09-22 — no October, no November, and none of the newly scraped NAWBO Richmond events, even though all of them are **Approved** in Airtable with future dates.

`listRecordsPage` sent the requested page size as Airtable's **`maxRecords`**. `maxRecords` caps the **total** result set, not the page: once Airtable has returned that many records it considers the query finished and **omits `offset`**. The handler therefore always returned `nextOffset: null`, `hasMore` in `App` was always false, and both the intersection-observer sentinel and the "Load more" button in `EventList` were permanently inert. The calendar was frozen at the first page, sorted by Start Date ascending.

Measured against production on 2026-09-20:
- 358 approved events, **306** matching `EVENTS_LIST_FILTER_FORMULA`
- `GET /api/events` returned **100** events, `nextOffset: null`, last start date **2026-09-22**
- `?limit=25` returned 25 with `nextOffset: null`; `?limit=50` returned 50 with `nextOffset: null` — the offset is suppressed at whatever value is sent, which is the signature of `maxRecords`
- 206 events, including all of Oct/Nov and the 5 new NAWBO rows, were unreachable

The `End Date` clause was also suspected and cleared: of 73 approved rows with a blank `End Date`, the filter drops **0**. The 52 rows it does drop are all genuinely older than the 30-day window, which is the intent.

### Decision
- Send **`pageSize`** in `listRecordsPage` (`api/_lib/airtable.ts`). Nothing else changes: same query params, same `{ events, nextOffset }` response shape, same ≤100 cap.
- Leave `listRecords` alone — its `maxRecords` use (e.g. `findByEventId` with `maxRecords: 1`) is a genuine total cap and is correct.
- `api/events.test.ts` asserted `maxRecords=100` / `maxRecords=50`, so the suite encoded the bug. Updated both, and added a regression test that asserts `maxRecords` is **never** sent on the list path.

### Tradeoffs
- The mocked Airtable in `events.test.ts` returns an `offset` alongside `maxRecords`, which the real API will not do. Tests can confirm which parameter is sent, but cannot catch this class of bug on their own — hence asserting the parameter explicitly rather than only asserting the mapped response.
- Lazy loading is unchanged, so the month grid and client-side search still only see loaded pages. With 306 events that is 4 pages; making the grid month-complete would mean prefetching or a server-side month query, and is deliberately not part of this fix.

### Context
Schedule cards used `object-cover` and a fixed `max-h-56`, which cropped varied banner/portrait/flyer assets unpredictably.

### Decision
- Add **`getPromoImageMaxHeightClass(ratio)`** in **`src/utils/eventPromoImage.ts`** (ratio = width/height): very wide (≥2) → shorter cap; wide 1.25–2 → `max-h-64`; square-ish 0.85–1.25 → `max-h-56`; portrait (&lt;0.85) → `max-h-96`.
- **`EventPromoImage`**: **`object-contain`**, default **`max-h-56`** until **`onLoad`**, then tier; portrait tier **`max-h-80`** (was 96) to limit huge verticals. Outer **`flex justify-center`**, inner **`inline-block max-w-full`** so the bordered frame **hugs** the image width (avoids full-width pillarboxing on portraits). **`w-auto`** on the **`img`**.
- **`ScheduleEventCard`** uses **`EventPromoImage`** instead of raw **`ImageWithFallback`** + cover.

### Tradeoffs
- Full image visible; letterboxing possible. Slight layout shift when max-height class updates after load.

## 2026-04-07 - Dark mode disabled

### Context
The app followed OS dark mode via `prefers-color-scheme` and toggled `html.dark`. Product goal is light UI only for now.

### Decision
- Remove **`isDarkMode`** state, system **`matchMedia`** listener, and theme **`useEffect`** from **`App`**; on mount **`classList.remove('dark')`** so no stray class persists.
- Set **`color-scheme: light`** on **`html`** in **`globals.css`** so native controls and scrollbars stay light.
- Delete unused **`.dark` / `html.dark`** theme variable blocks and **`.dark .geometric-bg`** from **`globals.css`**; remove **`@custom-variant dark`**.
- Keep **`tailwind.config.js`** as **`darkMode: 'class'`** so **`dark:`** utilities only apply under **`.dark`** (never set) — avoids Tailwind v3 treating **`darkMode: false`** like **`media`** (which would still follow OS).
- **`Toaster` (sonner):** **`theme="light"`**, drop **`next-themes`**; remove **`next-themes`** dependency.

## 2026-04-07 - Email signup for upcoming events (GET webhook)

### Context
Users can subscribe to an emailed list of upcoming events from the main calendar column.

### Decision
- Add **`EmailSignup`** under the left **`Calendar`**, calling **`GET`** `{webhookUrl}?email={encoded}` via **`fetch`** (`subscribeByEmail` in `src/services/subscribeApi.ts`).
- Default webhook URL in **`siteConfig`** (`SUBSCRIBE_WEBHOOK_URL`), overridable with **`VITE_SUBSCRIBE_WEBHOOK_URL`** (see `env.example`). Production default: Railway **`/webhook/subscribe`**.
- On HTTP **2xx**, show inline success copy; on failure, show a short error and allow retry.

### Tradeoffs
- **GET** for subscription is not ideal for semantics or caching; chosen to match the existing webhook contract.
- **CORS** must allow the app origin on the webhook host; if blocked, the flow would need a same-origin proxy or form navigation.

## 2026-04-07 - Initial list scroll near “today”; gate calendar month sync

### Context
The event list starts at `scrollTop = 0`, so the earliest loaded month is “nearest” to the top. `EventList` calls `onTopVisibleMonthChange`, which drove `activeMonth` to that past month. A separate `useEffect` also set `activeMonth` from the first filtered event, reinforcing the same jump.

### Decision
- Remove the effect that synced `activeMonth` from `filteredEvents[0]` (it also fought search and pagination UX).
- After the first load completes (no active search), compute an anchor day with **`pickInitialListScrollDay`** in `src/utils/initialListScroll.ts`: first event whose **local** start day is on/after today, else first event still **ongoing** (`endDate >=` local start of today), else the first row.
- Set **`scrollToDay`** once; use **`scrollToDayBehavior: 'auto'`** for that pass so layout and month detection are stable, then switch to **`smooth`** for calendar-driven scrolls.
- Add **`syncVisibleMonthToParent`** on **`EventList`** (default `true`). **`App`** keeps it `false` until `onScrollToDayComplete` or when there is nothing to scroll (empty list, or search active on first paint).

### Tradeoffs
- “Today” for anchoring uses the **browser’s local calendar**, matching **`dayKeyLocal`** in **`EventList`**, not US Eastern display strings.

## 2026-04-07 - Paginated GET /api/events + 30-day End Date window

### Context
`GET /api/events` loaded the entire Events table via Airtable pagination in one handler call, and the UI only simulated “load more” by revealing slices of that array.

### Decision
- Add **`listRecordsPage`** in `api/_lib/airtable.ts` (single request + optional **`sort`**).
- **`GET /api/events`** returns **`{ events, nextOffset }`**, accepts **`limit`** (≤100) and **`offset`**, uses **`filterByFormula`**: approved status + **`End Date`** not before **`DATEADD(TODAY(), -30, 'days')`** (see `EVENTS_LIST_FILTER_FORMULA` in `api/events.ts`). Sort **`Start Date`** ascending.
- Client: **`getEventsPage`**, **`getEvents`** aggregates all pages; **`App`** accumulates pages on “Load more” / intersection observer with **`loadingMore`** guard; removed **`visibleCount`** slicing.

### Tradeoffs
- Search and calendar dots only see **loaded** pages until the user loads more.
- The 30-day cutoff uses Airtable **`TODAY()`** (base timezone), not the app’s Eastern display helpers.

## 2026-04-07 - Viewport-locked layout; event list fills remaining height

### Context
The main column used a fixed `max-height` (`min(34rem, …dvh)`) so the document could still grow (`min-h-screen`) and the list did not use all vertical space below the header.

### Decision
- `html` / `body` / `#root`: `height: 100%`, `overflow: hidden` on the document; `#root` is a flex column so the app can fill the viewport without window scroll.
- `App` root uses `h-full min-h-0 flex-1 flex-col overflow-hidden` instead of `min-h-screen`.
- Main grid uses `flex-1 min-h-0`; on small screens `grid-rows-[auto_minmax(0,1fr)]` so the list row consumes remaining height; on `lg`, two columns with `lg:h-full` so the list column stretches with the row.
- Removed fixed heights on the list wrapper; `EventList` keeps internal `overflow-y-auto` for long lists.
- Footer padding reduced slightly (`py-4`) to preserve room for the main grid.

## 2026-04-07 - Production Node server for Railway (`server.ts`)

### Context
`npm run build` produces static assets only. Vite dev middleware mounts `/api/events`, but **`vite preview` and static hosts** serve `index.html` for unknown paths, so `/api/events` returned HTML and the client threw `Unexpected token '<'` when parsing JSON. Railway (and similar) deployments that only ran static hosting or `vite preview` had no working API.

### Decision
- Add **`server.ts`**: Node HTTP server that serves `dist/` (with SPA fallback) and delegates **`/api/events`** to the existing `api/events.ts` handler.
- Add **`api/_lib/nodeHttpAdapter.ts`** and reuse it from **`vite.config.ts`** dev middleware to avoid duplicating Node ↔ Web `Request`/`Response` conversion.
- **`npm start`** → `tsx server.ts`; dependencies **`tsx`** and **`dotenv`** (load `.env` locally).
- **`GET /health`** for readiness.
- **`eventsApi`**: stricter JSON handling with a clearer error when the response is HTML; still accept JSON bodies when `Content-Type` is missing or `text/plain` if the body looks like JSON (tests and some proxies).

### Tradeoffs
- Production requires a Node process (not pure static CDN). For static-only hosting, run the API elsewhere and set **`VITE_API_BASE_URL`**.

## 2026-04-06 - Calendar day dots match schedule accent colors

### Context
Month cells used a single fuchsia dot for “has events,” while list cards used a rotating pink / amber / cyan accent tied to position in the grouped schedule.

### Decision
- Add `getScheduleAccentColor` in `src/utils/scheduleAccent.ts` using the same month-group + insertion order as `EventList`.
- Pass `accentSourceEvents={filteredEvents}` into `EventList` so card colors stay aligned with the full filtered set when the list is paginated (“load more”).
- Render one dot per event on a day (same colors as the cards); multiple events stack as small dots in a row.

## 2026-04-06 - Remove event details modal

### Context
Schedule list cards were wrapped in a click handler that opened `EventDetailsModal`, so clicks on non-link areas (including the “Hosted by …” line) triggered the modal. Event content is already visible on the card, and the title can link out when `event.link` is set.

### Decision
- Remove `EventDetailsModal` and all wiring (`onEventClick` on `EventList` / `ScheduleEventCard`, `?event=` deep-link behavior that opened the details modal, related `App` / `EmbedApp` state).
- Cards are no longer globally clickable; interactive elements remain the optional title link, map link for address-like locations, and images.

### Tradeoffs
- No full-screen detail view; users rely on the card body and external links.
- Bookmarks with `?event=` no longer open a modal (URL cleanup on navigation was tied to that flow).

## 2026-03-19 - Default Calendar To Current Date And Remove Seed Data

### Context
The calendar UI loaded to a hardcoded month (`June 2025`), which made first render inconsistent with user expectations for a live calendar. The app and embed entry points also contained 2025 sample events used as a fallback/seed path.

### Decision
- Initialize calendar month state from `today` at runtime (first day of the current month).
- Remove sample event generators and seeded sample-event initialization from both main and embed app flows.
- On API load failure in the main app, default to an empty event list instead of injecting demo data.

### Rationale
- Aligns initial load with real-time usage expectations.
- Prevents stale demo data from driving visible behavior.
- Keeps existing event/filter code paths intact while simplifying startup state.

### Tradeoffs
- Empty state is now visible when data loading fails or no events exist.
- No built-in demo content for local showcases unless data is provided via API/source.

## 2026-03-20 - Event List As Horizontal Carousel

### Context
The list view showed events in a vertical stack. We wanted to explore a schedule-style layout closer to a horizontal carousel with a “Schedule — {date}” header and card slides.

### Decision
- Replace the vertical event list in `EventList` with a shadcn/embla `Carousel`: one slide per event, responsive `basis` widths for roughly one to three visible cards.
- Add a header row with title **Schedule**, subtitle **— {month day}** from the **first sorted visible event** after existing date/time sorting.
- Extract slide UI into `ScheduleEventCard` (left tag accent, time row, title, notes, footer with location or avatars, overflow menu for view link / copy link / external link).

### Rationale
- Reuses existing `src/components/ui/carousel.tsx` and keeps filter/tag behavior unchanged.
- Header date matches the primary (first) item in the ordered list, consistent with user expectation for “current schedule” context.

### Tradeoffs
- Compact cards omit some fields from the old list (e.g. host org, inline tags); users can open details from the card or menu.
- Carousel navigation is less familiar than a full vertical list for very long schedules; can revisit with a layout toggle if needed.

## 2026-03-20 - Migrate Data Layer To Airtable Proxy

### Context
The app previously relied on NoCodeAPI + Google Sheets for event and settings persistence. We needed a more robust API model and better secret handling while preserving existing UI behavior and service call sites.

### Decision
- Replace NoCodeAPI/Google Sheets integration with Airtable-backed proxy routes (`/api/events`, `/api/settings`).
- Keep frontend service contracts stable (`getEvents`, `addEvent`, `updateEvent`, `deleteEvent`, `getSettings`, `updateSettings`) and swap internals to proxy calls.
- Add server-side Airtable mapping and environment validation (`AIRTABLE_PAT`, `AIRTABLE_BASE_ID`) with no client-side token usage.

### Rationale
- Improves security by keeping Airtable credentials server-only.
- Improves maintainability by centralizing mapping/normalization in proxy helpers.
- Minimizes UI refactor risk by preserving existing service interfaces used in `App`.

### Tradeoffs
- Introduces backend/runtime dependency for API routes in deployment.
- Adds schema mapping logic that must stay aligned with Airtable table/field definitions.

## 2026-03-30 - Local Dev API Routing Through Vite Middleware

### Context
Local `npm run dev` sessions were sometimes receiving HTML/JS content for `/api/settings` instead of JSON, causing frontend parse failures (`Unexpected token ... is not valid JSON`) and fallback defaults even though the Airtable-backed settings handler already existed.

### Decision
- Route local `/api/events` and `/api/settings` through Vite dev middleware to invoke existing API handlers in `api/events.ts` and `api/settings.ts`.
- Keep frontend service paths unchanged (`/api/*`) for parity with deployed environments.
- Add a defensive JSON content-type check in `src/services/settingsApi.ts` before parsing response bodies.

### Rationale
- Fixes the root cause (wrong local route target) instead of hiding it with client-only workarounds.
- Preserves existing server-side Airtable integration and avoids duplicate local data paths.
- Improves diagnostics when API responses are malformed or misrouted.

### Tradeoffs
- Adds dev-server middleware complexity in `vite.config.ts`.
- Local API behavior now depends on server-side environment variables (`AIRTABLE_PAT`, `AIRTABLE_BASE_ID`) during frontend development.

## 2026-04-06 - Simplified Events Split Layout (UI-Only)

### Context
The events experience needed to align with a simpler visual direction: one month calendar on the left, searchable upcoming events on the right, and continuous scrolling through event cards with month context that tracks the list position. The requested scope explicitly excluded backend/data-contract changes.

### Decision
- Refactor the main UI to a fixed two-column layout:
  - left: single controlled month calendar
  - right: search input + vertically scrolling event card list
- Replace carousel-style list interactions with an infinite reveal list driven by frontend state (`visibleCount`) and `IntersectionObserver` sentinel behavior.
- Keep event sourcing and CRUD paths unchanged (`getEvents`, `addEvent`, `updateEvent`, `deleteEvent`), and implement search filtering client-side only.
- Synchronize the left calendar month with the right list’s top visible month while preserving manual month navigation controls.

### Rationale
- Matches the new screenshot-inspired UX without introducing backend risk.
- Reuses existing component paths (`Calendar`, `EventList`, `ScheduleEventCard`) rather than introducing parallel/redundant screens.
- Maintains existing modal and event-detail flows while simplifying browse/search behavior.

### Tradeoffs
- Infinite reveal still relies on all events already loaded in the client; very large datasets may eventually require virtualization.
- Search is currently in-memory and scoped to loaded event fields, not server-backed relevance.
- Month synchronization is DOM-position based, which is intentionally lightweight but may need refinement for highly dynamic card heights.

## 2026-04-06 - Client-Side Token Search Over Loaded Events

### Context
Search filtered only the upcoming subset with a single substring over a few fields, so users could not find past events or match multiple keywords reliably.

### Decision
- Add [`src/utils/eventSearch.ts`](src/utils/eventSearch.ts) with normalized text, whitespace-separated query tokens, a combined haystack per event (title, notes, location, host organization, link, tags, attendee names, and human-readable start/end date strings), and **AND** semantics (every token must appear as a substring).
- When the search box is **empty**, keep the existing **upcoming-only** list (including the fallback when nothing is upcoming).
- When the query is **non-empty**, search **all events** returned from the API, sorted by `startDate` ascending.

### Rationale
- No backend or third-party search services; behavior is predictable and unit-testable.
- Past events become discoverable when actively searching, without changing the default browse experience.

### Tradeoffs
- Ranking is chronological only, not relevance-ranked.
- Performance depends on in-memory list size; acceptable for typical calendar loads.

## 2026-04-06 - Airtable-only event model, naming cleanup, Eastern time display

### Context
The codebase still referenced Google Sheets naming for the events HTTP client, and the product model included attendees, tags, and recurrence that are no longer part of the Airtable-backed workflow. Settings still exposed tag lists used only for event tagging.

### Decision
- Rename the frontend events module to `src/services/eventsApi.ts` (same `/api/events` contract).
- Remove **attendees**, **tags**, and **recurrence** from the `Event` type, API `EventPayload`, mappers, UI (modals, cards, list compact), and search haystack.
- Remove **tags** and **tag_labels** from the settings shape and API mapping; stop reading them into the frontend and stop writing them from `PUT /api/settings` (legacy Airtable columns may remain).
- Standardize **user-visible** event date/time formatting on **US Eastern** (`America/New_York`) via `src/utils/eventTime.ts`; interpret Airtable **date-only** `Start Date` / `End Date` values as **midnight that calendar day in Eastern** when mapping to ISO in `api/_lib/mappers.ts`.

### Rationale
- Aligns naming and data model with an Airtable-only backend and reduces unused surface area.
- One display timezone avoids ambiguous local browser formatting for a region-specific calendar.
- Slimmer settings and event payloads simplify maintenance and tests.

### Tradeoffs
- Existing Airtable tag/recurrence columns are no longer surfaced; manual base cleanup is optional.
- Calendar grid month/day bucketing still uses the browser’s local date for cell keys (unchanged); list and modal formatting use Eastern as documented.

## 2026-04-06 - Remove Airtable-backed app settings

### Context
Site settings were loaded from `GET /api/settings` (Airtable `app_settings`). On static or misconfigured hosts the route returned HTML (SPA fallback), triggering non-JSON warnings. Product need for remote-editable settings was minimal.

### Decision
- Remove `api/settings.ts`, the `/api/settings` dev route, `src/services/settingsApi.ts`, and the unused `SettingsModal` UI.
- Keep footer links and related copy in `src/siteConfig.ts` as static exports.

### Rationale
- Eliminates a failing network path and deployment coupling for data we do not need to store in Airtable.
- Fewer env vars and less server surface area.

### Tradeoffs
- Changing footer links or marketing copy requires a code change instead of an Airtable row.

## 2026-04-06 - Event list: vertical Embla carousel and main/footer flex layout

### Context
Scroll-snap and overflow on the event column still clipped cards and a `100vh`-based column height let the page grow below the footer.

### Decision
- Render visible events in `EventList` with shadcn/Embla `Carousel` (`orientation="vertical"`), one slide per event; month headings on first event of each month; sync calendar month from Embla `select`; `scrollToDay` uses `api.scrollTo(index)`; optional load-more when the user reaches the last slide (guarded so single-slide lists do not auto-fetch on mount); manual “Load more” and IntersectionObserver sentinel retained.
- Extend `carousel.tsx` with vertical viewport height (`h-full min-h-0`), column inner `h-full`, ArrowUp/ArrowDown keyboard handling, and `min-h-0` on vertical items.
- Structure the app shell as `min-h-screen flex flex-col` with a `flex-1 min-h-0` main region and `shrink-0` footer; size the event column with grid stretch and `min-h-*` floors instead of `calc(100vh - …)` alone.

### Rationale
- Embla gives stable snap-to-slide behavior and avoids layout overflow quirks from nested scroll areas.
- Flex layout allocates remaining height between header and footer so the document does not extend past the footer when the list is tall.

### Tradeoffs
- Very tall cards are clipped per slide (`overflow-hidden`) so vertical gestures go to Embla; users move between events via swipe, keyboard, or the on-card nav buttons.

### Follow-up (same day)
- Embla’s default `containScroll: 'trimSnaps'` can collapse to **one scroll snap** when total slide height fits in the viewport (`contentSize <= viewSize`), which made **only the first event reachable**. Set **`containScroll: false`** so each slide keeps its own snap, and use **stable keys** `id + index` in case duplicate `Event ID` values exist in source data. Added **Previous/Next** controls and `touch-pan-y` on the track; removed nested `overflow-y-auto` on slides so vertical drags reach Embla.

### Follow-up — revert to plain scroll list
- **Removed** the vertical Embla carousel from `EventList` in favor of a **plain `overflow-y-auto` list** (month groups, scroll-linked calendar month, day anchors, load-more). Variable-height cards and scroll/wheel interaction behaved poorly with Embla for this UI.
- The scroll region uses **`border-b border-border`** so the bottom edge of the clipping area is visible without wrapping the whole column in a box border.

## 2026-04-06 - Schedule list card layout and optional hero image

### Context
List cards used a three-dot menu, left-aligned time/date, and small title. We wanted alignment closer to a reference: title + optional host on the left, date and time stacked on the right, optional image under the title, title linking to the public event URL.

### Decision
- **`ScheduleEventCard`**: Remove the overflow menu; top row is **title** (link to `event.link` when present, larger type) + optional **Hosted by** line on the left; **day number**, **month**, and **time** (`ALL DAY` or Eastern range) on the right; **notes** below; **rounded image** below the title when `event.imageUrl` is set; footer row is **location** only (map link when address-like).
- **`Event.imageUrl`**: Mapped in `api/_lib/mappers` from Airtable **`Image URL`** (plain https URL), then **`Image`**, **`Flyer`**, and **`Cover Image`**, each of which may be either a **plain https URL string** (e.g. long text / URL field) or the **first attachment** in Airtable’s attachment shape.

### Tradeoffs
- Event URL is both the card title link and the prior “open external” menu action; there is no in-card “copy link” from the menu anymore (users can copy from the browser).
