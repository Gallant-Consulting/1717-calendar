import { MapPin } from 'lucide-react';
import type { Event } from '../types';
import { EventPromoImage } from './EventPromoImage';
import { cn } from './ui/utils';
import {
  formatEventTimeEastern,
  formatMonthNameLongEastern,
} from '../utils/eventTime';

function formatTimeRange(event: Event): string {
  if (event.isAllDay) {
    return 'ALL DAY';
  }
  const start = formatEventTimeEastern(event.startDate);
  const end = formatEventTimeEastern(event.endDate);
  return `${start} — ${end}`;
}

function isLikelyStreetAddress(location: string): boolean {
  if (!location) return false;
  const streetSuffixes =
    /\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Court|Pl|Place|Circle|Cir|Pkwy|Parkway|Terrace|Ter|Loop|Trail|Trl|Crescent|Cres|Highway|Hwy)\b/i;
  return /\d/.test(location) && streetSuffixes.test(location);
}

export interface ScheduleEventCardProps {
  event: Event;
  accentColor: string;
}

export function ScheduleEventCard({ event, accentColor }: ScheduleEventCardProps) {
  const hasLocation = Boolean(event.location?.trim());
  const locationLabel = event.location?.trim() ?? '';
  const hasLink = Boolean(event.link?.trim());
  const timeLabel = formatTimeRange(event);

  const accentStyle = { color: accentColor } as const;
  const borderAccentStyle = { borderLeftColor: accentColor } as const;

  const dayNumber = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      day: 'numeric',
    }).format(event.startDate),
  );

  return (
    <div
      style={borderAccentStyle}
      className={cn(
        'flex flex-col rounded-md border border-gray-200 bg-card p-5 text-left shadow-sm',
        'border-l-4 border-solid',
      )}
    >
      <div className="mb-6">
        {/* Title + date badge row (desktop: side by side, mobile: title only) */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {hasLink ? (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ '--schedule-accent': accentColor } as React.CSSProperties}
                className="block text-xl font-semibold leading-snug tracking-tight text-foreground underline decoration-[#dbdbdb] decoration-2 underline-offset-2 transition-[text-decoration-color] duration-200 ease-out hover:[text-decoration-color:var(--schedule-accent)]"
              >
                {event.title}
              </a>
            ) : (
              <h3 className="text-xl font-semibold leading-snug tracking-tight text-foreground">{event.title}</h3>
            )}
            {/* Desktop: hosted by tucked under title, inside the flex-1 column */}
            {event.hostOrganization?.trim() ? (
              <p className="mt-1.5 hidden text-sm text-muted-foreground sm:block">
                Hosted by{' '}
                <span className="font-medium text-foreground/90">{event.hostOrganization.trim()}</span>
              </p>
            ) : null}
          </div>
          {/* Date badge: hidden on mobile, shown on desktop */}
          <div className="hidden shrink-0 text-right sm:block" style={accentStyle}>
            <div className="text-4xl font-light leading-none tabular-nums">{dayNumber}</div>
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide">
              {formatMonthNameLongEastern(event.startDate)}
            </div>
            <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{timeLabel}</p>
          </div>
        </div>

        {/* Mobile: hosted by + date/time side by side under the title */}
        <div className="mt-2 mb-2 flex items-baseline justify-between gap-4 sm:hidden">
          {event.hostOrganization?.trim() ? (
            <div className="min-w-0 text-sm text-muted-foreground">
              <p>Hosted by</p>
              <p className="font-medium text-foreground/90">{event.hostOrganization.trim()}</p>
            </div>
          ) : <span />}
          <div className="shrink-0 text-right" style={accentStyle}>
            <span className="text-2xl font-light tabular-nums">{dayNumber}</span>
            <span className="ml-1 text-xs font-semibold uppercase tracking-wide">
              {formatMonthNameLongEastern(event.startDate)}
            </span>
            {event.isAllDay ? (
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">ALL DAY</p>
            ) : (
              <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <p>{formatEventTimeEastern(event.startDate)} —</p>
                <p>{formatEventTimeEastern(event.endDate)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {event.imageUrl ? (
        <EventPromoImage src={event.imageUrl} alt={event.title} className="mb-4 w-full" loading="lazy" />
      ) : null}

      <p
        className={cn(
          'mb-4 min-h-[1.5rem] text-base text-muted-foreground',
          event.notes ? 'line-clamp-4' : 'line-clamp-1 italic opacity-70',
        )}
      >
        {event.notes ?? 'No description'}
      </p>

      {hasLocation ? (
        <div className="mt-auto pt-3">
          <div className="flex min-w-0 items-center gap-2 text-base text-muted-foreground">
            <MapPin className="size-4 shrink-0" style={accentStyle} aria-hidden />
            {isLikelyStreetAddress(locationLabel) ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-foreground underline decoration-[#dbdbdb] decoration-2 underline-offset-2 transition-[text-decoration-color] duration-200 ease-out hover:[text-decoration-color:var(--schedule-accent)]"
                style={{ '--schedule-accent': accentColor } as React.CSSProperties}
              >
                {locationLabel}
              </a>
            ) : (
              <span className="truncate">{locationLabel}</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
