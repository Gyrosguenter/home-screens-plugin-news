# Nachrichten mit Bildern — Home Screens Plugin

Natives [Home Screens](https://homescreens.dev)-Plugin: Schlagzeilen mit Vorschaubild, Quelle und Alter ("vor 12 Min."). Teil des Projekts [home-screens-magic-mirror](https://github.com/Gyrosguenter/home-screens-magic-mirror); als eigenes öffentliches Repo geführt, damit die Tarball-URL ohne Authentifizierung erreichbar ist.

- **Mehrere Feeds abwechselnd gemischt**, damit ein Feed mit vielen Meldungen die anderen nicht verdrängt; doppelte Überschriften entfallen.
- **Quellenname aus der Feed-Adresse** (z. B. "WELT", "SZ") statt Agenturkürzeln wie "DPA/SUF".
- **Nur Meldungen mit Bild** (abschaltbar), Altersfilter, mehrzeilige Überschriften.
- Die Feeds lädt und parst der Hub (`/api/news`, derselbe Endpunkt wie das eingebaute Nachrichten-Modul); das Plugin braucht also keine eigene RSS-Logik.

## Konfiguration

| Feld | Beschreibung |
|---|---|
| RSS-Feeds | Adressen, getrennt durch Leerzeichen/Komma; `local` = Google-News für den Standort |
| Anzahl Meldungen | 1–10 (Standard 5) |
| Nur Meldungen mit Bild / Quelle anzeigen | Schalter |
| Maximales Alter | Stunden, 0 = kein Limit (Standard 72) |

Standard-Feeds: Merkur München, SZ München, SPIEGEL, WELT.

## Build

```bash
npm install && npm run build
npm test
```

Release-Tarball aus `manifest.json` + `dist/`; in Home Screens unter *Plugins → Aus URL installieren*.

MIT
