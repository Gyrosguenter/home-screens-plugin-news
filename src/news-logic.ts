/** Ein Artikel, wie ihn der Hub unter `/api/news` liefert. */
export interface NewsItem {
  id?: string;
  title: string;
  link?: string;
  timestamp: number | null;
  imageUrl: string | null;
  publisher?: string;
}

export interface FeedResult {
  url: string;
  ok: boolean;
  title?: string;
  items?: NewsItem[];
}

export interface DisplayItem {
  key: string;
  title: string;
  imageUrl: string | null;
  timestamp: number | null;
  source: string;
}

export const DEFAULT_FEEDS = [
  'https://www.merkur.de/muenchen/rssfeed.rdf',
  'https://rss.sueddeutsche.de/rss/Muenchen',
  'https://www.spiegel.de/schlagzeilen/index.rss',
  'https://www.welt.de/feeds/latest.rss',
];

/** "url1, url2 url3" → Liste, getrennt an Komma, Semikolon und Leerraum. */
export function parseFeedList(text: unknown): string[] {
  if (typeof text !== 'string') return DEFAULT_FEEDS;
  const list = text.split(/[\s,;]+/).filter((part) => part.length > 0);
  return list.length > 0 ? list : DEFAULT_FEEDS;
}

const KNOWN_SOURCES: Record<string, string> = {
  'tagesschau.de': 'tagesschau',
  'sueddeutsche.de': 'SZ',
  'rss.sueddeutsche.de': 'SZ',
  'welt.de': 'WELT',
  'spiegel.de': 'SPIEGEL',
  'merkur.de': 'Merkur',
  'bild.de': 'BILD',
  'zeit.de': 'ZEIT',
  'faz.net': 'FAZ',
  'heise.de': 'heise',
};

/** "https://www.welt.de/feeds/latest.rss" → "welt.de". */
export function hostName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Quellenname aus der Feed-Adresse. Der `publisher` der Artikel taugt nicht:
 *  bei Welt steht dort oft ein Agenturkürzel ("DPA/SUF") oder "WELT TV". Nur
 *  für den lokalen Google-News-Feed (`local`), der Artikel vieler Medien
 *  mischt, ist der Herausgeber des Artikels die richtige Angabe. */
export function sourceName(feedUrl: string, item: NewsItem): string {
  if (feedUrl === 'local') return item.publisher ?? 'Lokal';
  const host = hostName(feedUrl);
  return KNOWN_SOURCES[host] ?? host;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export interface PickOptions {
  maxItems: number;
  requireImage: boolean;
  /** 0 = kein Altersfilter. */
  maxAgeHours: number;
  now: number;
}

/** Wählt die anzuzeigenden Artikel: pro Feed nach Zeit sortiert, dann
 *  reihum über die Feeds, damit ein Feed mit vielen Meldungen (Welt) die
 *  anderen nicht verdrängt. Doppelte Überschriften entfallen. */
export function pickItems(feeds: FeedResult[], options: PickOptions): DisplayItem[] {
  const { maxItems, requireImage, maxAgeHours, now } = options;
  const maxAgeMs = maxAgeHours > 0 ? maxAgeHours * 3600 * 1000 : Infinity;

  const queues: DisplayItem[][] = feeds
    .filter((feed) => feed.ok && feed.items && feed.items.length > 0)
    .map((feed) =>
      (feed.items ?? [])
        .filter((item) => item.title && item.title.trim().length > 0)
        .filter((item) => !requireImage || Boolean(item.imageUrl))
        .filter((item) => item.timestamp === null || now - item.timestamp <= maxAgeMs)
        .sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity))
        .map((item) => ({
          key: item.id ?? item.link ?? item.title,
          title: item.title.trim(),
          imageUrl: item.imageUrl,
          timestamp: item.timestamp,
          source: sourceName(feed.url, item),
        })),
    );

  const seen = new Set<string>();
  const picked: DisplayItem[] = [];
  let progressed = true;
  while (picked.length < maxItems && progressed) {
    progressed = false;
    for (const queue of queues) {
      while (queue.length > 0) {
        const next = queue.shift()!;
        const norm = normalizeTitle(next.title);
        if (seen.has(norm)) continue;
        seen.add(norm);
        picked.push(next);
        progressed = true;
        break;
      }
      if (picked.length >= maxItems) break;
    }
  }
  return picked;
}

/** "vor 12 Min.", "vor 3 Std.", sonst Datum; leer ohne Zeitstempel. */
export function timeAgo(timestamp: number | null, now: number): string {
  if (timestamp === null) return '';
  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}
