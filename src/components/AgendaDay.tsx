import { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Event } from '../types';
import type { AgendaDay as AgendaDayData } from '../utils/agendaGroups';
import {
  formatEventTimeEastern,
  formatMonthNameLongEastern,
  formatWeekdayLongEastern,
  getEasternCalendarBadge,
} from '../utils/eventTime';
import { cn } from './ui/utils';

function isLikelyStreetAddress(location: string): boolean {
  if (!location) return false;
  const streetSuffixes =
    /\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Court|Pl|Place|Circle|Cir|Pkwy|Parkway|Terrace|Ter|Loop|Trail|Trl|Crescent|Cres|Highway|Hwy)\b/i;
  return /\d/.test(location) && streetSuffixes.test(location);
}

const linkUnderline =
  'underline decoration-border decoration-2 underline-offset-[3px] transition-[text-decoration-color] duration-200 hover:decoration-primary';

/** Square thumbnail; removes itself if the host blocks or drops the image. */
function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-14 shrink-0 rounded bg-accent object-cover sm:size-20"
    />
  );
}

function AgendaRow({ event }: { event: Event }) {
  const location = event.location?.trim() ?? '';
  const host = event.hostOrganization?.trim() ?? '';
  const link = event.link?.trim() ?? '';
  const title = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className={linkUnderline}>
      {event.title}
    </a>
  ) : (
    event.title
  );

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-4 sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:px-5">
      <p className="col-span-2 text-[13px] font-semibold tabular-nums text-toned sm:col-span-1 sm:pt-0.5">
        {event.isAllDay ? (
          'All day'
        ) : (
          <>
            <span>{formatEventTimeEastern(event.startDate)}</span>
            <span className="font-medium text-dimmed sm:block">
              <span className="sm:hidden"> – </span>
              <span className="hidden sm:inline">to </span>
              {formatEventTimeEastern(event.endDate)}
            </span>
          </>
        )}
      </p>

      <div className="min-w-0">
        <h4 className="text-base font-semibold leading-snug text-card-foreground sm:text-[17px]">{title}</h4>
        {host ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-toned">{host}</span>
          </p>
        ) : null}
        {event.notes ? <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{event.notes}</p> : null}
        {location ? (
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-toned">
            <MapPin className="size-3.5 shrink-0 text-dimmed" aria-hidden />
            {isLikelyStreetAddress(location) ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('truncate', linkUnderline)}
              >
                {location}
              </a>
            ) : (
              <span className="truncate">{location}</span>
            )}
          </p>
        ) : null}
      </div>

      {event.imageUrl ? <Thumbnail src={event.imageUrl} /> : <span aria-hidden />}
    </li>
  );
}

export interface AgendaDayProps {
  day: AgendaDayData;
  isToday: boolean;
  /** Scroll anchor for "show this day" from the month calendar. */
  anchorRef?: (el: HTMLDivElement | null) => void;
}

/** One calendar day: the date once, then its events as ruled rows (mirrors the goodcompanyva.org lists). */
export function AgendaDay({ day, isToday, anchorRef }: AgendaDayProps) {
  const weekday = formatWeekdayLongEastern(day.date);
  const month = formatMonthNameLongEastern(day.date);
  const dayNumber = getEasternCalendarBadge(day.date).day;

  return (
    <div
      ref={anchorRef}
      role="group"
      aria-label={`${weekday}, ${month} ${dayNumber}`}
      data-day-key={day.key}
      className="grid grid-cols-1 border-t border-input first:border-t-0 sm:grid-cols-[112px_minmax(0,1fr)]"
    >
      <div className="border-b border-border px-4 py-2.5 sm:border-b-0 sm:border-r sm:px-4 sm:py-5">
        <div className="flex items-baseline gap-2 sm:sticky sm:top-3 sm:block">
          <p
            className={cn(
              'text-[11px] font-bold uppercase tracking-[0.2em]',
              isToday ? 'text-primary' : 'text-dimmed',
            )}
          >
            {isToday ? 'Today' : weekday}
          </p>
          <p
            className={cn(
              'font-headline text-2xl font-light leading-none tracking-[-0.02em] tabular-nums sm:mt-1 sm:text-[2.75rem]',
              isToday ? 'text-primary' : 'text-dimmed',
            )}
          >
            {dayNumber}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-toned sm:mt-1">{month}</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {day.events.map((event, idx) => (
          <AgendaRow key={`${event.id}-${idx}`} event={event} />
        ))}
      </ul>
    </div>
  );
}
