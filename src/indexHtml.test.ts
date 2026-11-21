import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// index.html is static (not rendered by React), so check its link-preview and icon tags directly.
const root = process.cwd();
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
// Plain tag parsing: a DOM parser in the test environment would try to fetch the font stylesheet.
const tags = [...html.matchAll(/<(meta|link)\s([^>]*?)\/?>/g)].map(([, tag, attrs]) => ({
  tag,
  attrs: Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
}));
const meta = (attr: 'property' | 'name', key: string) =>
  tags.find((t) => t.tag === 'meta' && t.attrs[attr] === key)?.attrs.content ?? null;
const links = (rel: RegExp) => tags.filter((t) => t.tag === 'link' && rel.test(t.attrs.rel ?? '')).map((t) => t.attrs.href);

describe('index.html link previews', () => {
  it('describes the calendar as Good Company on the new domain', () => {
    expect(html).toContain('<title>Greater Richmond Business Events | Good Company</title>');
    expect(links(/^canonical$/)).toEqual(['https://calendar.goodcompanyva.org/']);
    expect(meta('property', 'og:url')).toBe('https://calendar.goodcompanyva.org/');
    expect(meta('property', 'og:site_name')).toBe('Good Company');
    expect(html).not.toMatch(/1717/);
  });

  it('points og and twitter images at our own absolute 1200x630 PNG', () => {
    const image = 'https://calendar.goodcompanyva.org/og-image.png';
    expect(meta('property', 'og:image')).toBe(image);
    expect(meta('name', 'twitter:image')).toBe(image);
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')).toBeTruthy();

    const png = readFileSync(resolve(root, 'public/og-image.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('ships every icon and the manifest the page links to (same set as goodcompanyva.org)', () => {
    const hrefs = links(/(^|\s)icon$|^apple-touch-icon$|^manifest$/);
    expect(hrefs).toEqual(['/favicon.svg', '/favicon-96x96.png', '/favicon.ico', '/apple-touch-icon.png', '/site.webmanifest']);
    for (const href of hrefs) expect(existsSync(resolve(root, 'public', href.slice(1))), href).toBe(true);

    const manifest = JSON.parse(readFileSync(resolve(root, 'public/site.webmanifest'), 'utf8'));
    for (const icon of manifest.icons) expect(existsSync(resolve(root, 'public', icon.src.slice(1))), icon.src).toBe(true);
  });
});
