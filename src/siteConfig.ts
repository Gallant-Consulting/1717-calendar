/** Static site copy and footer links (no remote settings API). */

/** GET `?email=` — upcoming-events mailing list (override in env for staging). */
export const SUBSCRIBE_WEBHOOK_URL =
  import.meta.env.VITE_SUBSCRIBE_WEBHOOK_URL ??
  'https://n8n.workgallantly.com/webhook/subscribe';

/** The organization behind the calendar (formerly 1717 Collective); header wordmark and nav. */
export const GOOD_COMPANY = {
  name: 'Good Company',
  url: 'https://goodcompanyva.org/',
  startNavigatingUrl: 'https://goodcompanyva.org/needs',
} as const;

export const FOOTER_LINKS: Array<{ text: string; url: string }> = [
  { text: 'Terms of Service', url: '#' },
  { text: 'Privacy Policy', url: '#' },
  { text: 'Cookie Policy', url: '#' },
];
