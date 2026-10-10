import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle, scalePx } from './host-style';
import {
  parseFeedList,
  pickItems,
  timeAgo,
  type DisplayItem,
  type FeedResult,
} from './news-logic';

const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Holt die Feeds über den Hub (`/api/news`, derselbe Endpunkt wie das
 *  eingebaute Nachrichten-Modul): der Hub lädt und parst die RSS-Feeds
 *  serverseitig und liefert fertige Artikel samt Bild-URL und Zeitstempel.
 *  Bei einem Fehler bleiben die zuletzt geladenen Feeds stehen. */
function useFeeds(feedUrls: string[], refreshMs: number): FeedResult[] | null {
  const [feeds, setFeeds] = React.useState<FeedResult[] | null>(null);
  const key = feedUrls.join('\n');

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const query = feedUrls.map((url) => `feed=${encodeURIComponent(url)}`).join('&');
        const res = await fetch(`/api/news?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.feeds)) setFeeds(data.feeds as FeedResult[]);
      } catch {
        // Netz/Hub kurz weg: alte Anzeige behalten.
      }
    }

    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs]);

  return feeds;
}

function Thumbnail({ url }: { url: string | null }) {
  const [failed, setFailed] = React.useState(false);
  const box: React.CSSProperties = {
    width: scalePx(150),
    height: scalePx(100),
    borderRadius: scalePx(10),
    flexShrink: 0,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.25), rgba(51, 65, 85, 0.45))',
  };
  if (!url || failed) return <div style={box} />;
  return (
    <div style={box}>
      <img
        src={url}
        alt=""
        // Manche Medien sperren Hotlinking anhand des Referrers.
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

function Row({
  item,
  now,
  showSource,
  last,
  textScale,
}: {
  item: DisplayItem;
  now: number;
  showSource: boolean;
  last: boolean;
  textScale: number;
}) {
  const ago = timeAgo(item.timestamp, now);
  const meta = [showSource ? item.source : '', ago].filter(Boolean).join(' · ');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.8em',
        paddingBottom: '0.7em',
        borderBottom: last ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        animation: 'hs-news-in 0.7s ease both',
      }}
    >
      <Thumbnail url={item.imageUrl} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
        <div
          style={{
            fontSize: `${(1.05 * textScale).toFixed(3)}em`,
            fontWeight: 600,
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </div>
        {meta && <div style={{ fontSize: `${(0.7 * textScale).toFixed(3)}em`, opacity: 0.65 }}>{meta}</div>}
      </div>
    </div>
  );
}

export default function NewsImagesPlugin({ config, style }: PluginComponentProps) {
  const feedUrls = parseFeedList(config.feeds);
  const maxItems = Math.min(10, Math.max(1, Number(config.maxItems) || 5));
  const requireImage = config.requireImage !== false;
  const showSource = config.showSource !== false;
  const maxAgeHours = Math.max(0, Number(config.maxAgeHours ?? 72) || 0);
  const refreshMs = Math.max(60000, Number(config.refreshIntervalMs) || DEFAULT_REFRESH_MS);
  // Verkleinert nur die Schrift der Meldungen; Vorschaubilder bleiben so groß.
  const textScale = Math.min(1.2, Math.max(0.6, Number(config.textScale) || 1));
  const title = typeof config.title === 'string' ? config.title.trim() : 'Nachrichten';

  const feeds = useFeeds(feedUrls, refreshMs);
  const now = useNow(60000);

  const items = React.useMemo(
    () => (feeds ? pickItems(feeds, { maxItems, requireImage, maxAgeHours, now }) : null),
    // `now` bewusst nur minütlich: genügt für den Altersfilter.
    [feeds, maxItems, requireImage, maxAgeHours, now],
  );

  return (
    <div
      style={{
        ...hostFrameStyle(style),
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7em',
      }}
    >
      <style>{'@keyframes hs-news-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }'}</style>
      {title && <div style={{ fontSize: '1.3em', fontWeight: 600 }}>{title}</div>}

      {items === null && <div style={{ fontSize: '0.85em', opacity: 0.6 }}>Lade Nachrichten…</div>}
      {items && items.length === 0 && (
        <div style={{ fontSize: '0.85em', opacity: 0.6 }}>Keine Nachrichten verfügbar</div>
      )}
      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7em', minHeight: 0 }}>
          {items.map((item, i) => (
            <Row
              key={item.key}
              item={item}
              now={now}
              showSource={showSource}
              last={i === items.length - 1}
              textScale={textScale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
