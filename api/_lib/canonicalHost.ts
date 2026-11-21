/** Public host for the calendar. Old hosts redirect here so links in past emails and on other sites keep working. */
export const CANONICAL_HOST = 'calendar.goodcompanyva.org';

/** Hosts that used to serve the calendar. Only these redirect; Railway and localhost hosts are left alone. */
export const LEGACY_HOSTS: readonly string[] = [
  'calendar.goodcompanyrva.org',
  'calendar.1717collective.org',
];

/**
 * Where to send a request that arrived on a legacy host, or `null` to serve it normally.
 * `hostHeader` is the raw `Host` header (may carry a port); `pathAndQuery` is `req.url`.
 */
export function legacyHostRedirect(
  hostHeader: string | undefined,
  pathAndQuery: string | undefined,
): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!LEGACY_HOSTS.includes(host)) return null;
  const path = pathAndQuery && pathAndQuery.startsWith('/') ? pathAndQuery : '/';
  return `https://${CANONICAL_HOST}${path}`;
}
