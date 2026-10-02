import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEEDS,
  hostName,
  parseFeedList,
  pickItems,
  sourceName,
  timeAgo,
  type FeedResult,
  type NewsItem,
} from './news-logic';

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);
const MIN = 60 * 1000;

function item(title: string, minutesAgo: number | null, image: string | null = 'https://img/x.jpg'): NewsItem {
  return { id: title, title, timestamp: minutesAgo === null ? null : NOW - minutesAgo * MIN, imageUrl: image };
}

function feed(url: string, items: NewsItem[], ok = true): FeedResult {
  return { url, ok, items };
}

const opts = { maxItems: 4, requireImage: true, maxAgeHours: 72, now: NOW };

describe('parseFeedList', () => {
  it('trennt an Komma, Semikolon und Leerraum', () => {
    expect(parseFeedList('https://a.de/rss, https://b.de/rss;\nhttps://c.de/rss')).toEqual([
      'https://a.de/rss',
      'https://b.de/rss',
      'https://c.de/rss',
    ]);
  });
  it('leer → Standard-Feeds', () => {
    expect(parseFeedList('')).toEqual(DEFAULT_FEEDS);
    expect(parseFeedList(undefined)).toEqual(DEFAULT_FEEDS);
  });
});

describe('sourceName', () => {
  it('nimmt den Namen aus der Feed-Adresse, nicht das Agenturkürzel', () => {
    const a: NewsItem = { title: 'x', timestamp: null, imageUrl: null, publisher: 'DPA/SUF' };
    expect(sourceName('https://www.welt.de/feeds/latest.rss', a)).toBe('WELT');
    expect(sourceName('https://rss.sueddeutsche.de/rss/Muenchen', a)).toBe('SZ');
    expect(sourceName('https://www.unbekannt.org/feed', a)).toBe('unbekannt.org');
  });
  it('lokaler Google-News-Feed nutzt den Herausgeber des Artikels', () => {
    expect(sourceName('local', { title: 'x', timestamp: null, imageUrl: null, publisher: 'diebayern.de' })).toBe(
      'diebayern.de',
    );
  });
  it('hostName entfernt www', () => {
    expect(hostName('https://www.welt.de/x')).toBe('welt.de');
  });
});

describe('pickItems', () => {
  it('wechselt reihum zwischen den Feeds', () => {
    const feeds = [
      feed('https://www.welt.de/f', [item('W1', 1), item('W2', 2), item('W3', 3)]),
      feed('https://www.spiegel.de/f', [item('S1', 5), item('S2', 6)]),
    ];
    expect(pickItems(feeds, opts).map((i) => i.title)).toEqual(['W1', 'S1', 'W2', 'S2']);
  });

  it('sortiert je Feed nach Zeit, neueste zuerst', () => {
    const feeds = [feed('https://www.welt.de/f', [item('alt', 50), item('neu', 5)])];
    expect(pickItems(feeds, opts).map((i) => i.title)).toEqual(['neu', 'alt']);
  });

  it('lässt Artikel ohne Bild weg, wenn Bilder verlangt sind', () => {
    const feeds = [feed('https://www.welt.de/f', [item('ohne', 1, null), item('mit', 2)])];
    expect(pickItems(feeds, opts).map((i) => i.title)).toEqual(['mit']);
    expect(pickItems(feeds, { ...opts, requireImage: false }).map((i) => i.title)).toEqual(['ohne', 'mit']);
  });

  it('verwirft zu alte Artikel, Altersfilter 0 schaltet ihn ab', () => {
    const feeds = [feed('https://www.welt.de/f', [item('frisch', 10), item('uralt', 60 * 24 * 10)])];
    expect(pickItems(feeds, opts).map((i) => i.title)).toEqual(['frisch']);
    expect(pickItems(feeds, { ...opts, maxAgeHours: 0 }).map((i) => i.title)).toEqual(['frisch', 'uralt']);
  });

  it('entfernt doppelte Überschriften über Feeds hinweg', () => {
    const feeds = [
      feed('https://www.welt.de/f', [item('Gleiche Meldung!', 1)]),
      feed('https://www.spiegel.de/f', [item('gleiche meldung', 2), item('Andere', 3)]),
    ];
    expect(pickItems(feeds, opts).map((i) => i.title)).toEqual(['Gleiche Meldung!', 'Andere']);
  });

  it('überspringt fehlerhafte Feeds und begrenzt auf maxItems', () => {
    const feeds = [
      feed('https://www.chip.de/rss', [], false),
      feed('https://www.welt.de/f', [item('1', 1), item('2', 2), item('3', 3)]),
    ];
    expect(pickItems(feeds, { ...opts, maxItems: 2 })).toHaveLength(2);
  });
});

describe('timeAgo', () => {
  it('formatiert relative Zeiten', () => {
    expect(timeAgo(NOW - 20 * 1000, NOW)).toBe('gerade eben');
    expect(timeAgo(NOW - 12 * MIN, NOW)).toBe('vor 12 Min.');
    expect(timeAgo(NOW - 3 * 60 * MIN, NOW)).toBe('vor 3 Std.');
    expect(timeAgo(NOW - 30 * 60 * MIN, NOW)).toBe('gestern');
    expect(timeAgo(NOW - 72 * 60 * MIN, NOW)).toBe('vor 3 Tagen');
    expect(timeAgo(null, NOW)).toBe('');
  });
});
