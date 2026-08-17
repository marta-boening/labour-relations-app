# Labour Relations App

Multi-Agenten-Webapp für Labour Relations: Chat, Fallverlauf, Prompt-Bibliothek, Agenten-Netzwerk,
Risiko-Radar, Wissen und Einstellungen — im Petrol-Sand-Design. Backend ist eine eigenständige
Portierung des ursprünglichen n8n-Workflows ("Labour Relations Multiagent_final"), läuft ohne n8n
direkt als Node.js-Server. Frontend ist eine React-App (`web/`), optional mit Supabase als
Nutzer-/Falldatenbank.

## Starten (lokale Entwicklung, zwei Prozesse)

```bash
cd server
npm start
```

```bash
cd web
npm install    # nur beim ersten Mal
npm run dev
```

Frontend während der Entwicklung: http://localhost:5173 (spricht den Server auf Port 3001 an).

## Starten (ein Prozess, Produktions-Build)

```bash
cd web && npm install && npm run build && cd ../server && npm start
```

Dann im Browser öffnen: http://localhost:3001 — der Server liefert den gebauten Frontend-Build
(`web/dist`) direkt mit aus. Ohne vorherigen `npm run build` in `web/` fällt der Server automatisch
auf das alte `chat.html` als Startseite zurück (siehe `server/src/index.js`).

## Stoppen

Im Terminal, in dem der Server läuft: `Ctrl + C`

Falls er im Hintergrund läuft (z.B. über `nohup`):
```bash
pkill -f "node src/index.js"
```

## Struktur

- `web/` — React-Frontend (Vite + TypeScript + Tailwind), 7 Bereiche: Chat, Verlauf/Fälle,
  Prompts/Bibliothek, Agenten, Risiko-Radar, Wissen, Einstellungen. `web/.env` für
  `VITE_API_BASE_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (siehe `web/.env.example`).
- `chat.html` — alte, schlanke Chat-Oberfläche ohne Build-Schritt; bleibt als Fallback erreichbar
  unter `/chat.html`, ist aber nicht mehr die Standardseite.
- `server/src/pipeline.js` — Kompletter Workflow als Code: Router → RAG (Qdrant/Voyage) →
  Executor-Agent (Claude + Perplexity-Tool) → Formatierung. Routing-Prinzip: route whenever
  reasonably possible, clarify only when genuinely necessary (siehe `TECHNICAL.md`).
- `server/src/routerPrompt.js` — Router-System-Prompt (ursprünglich aus dem n8n-Workflow, seither
  überarbeitet — siehe `TECHNICAL.md` Abschnitt 2)
- `server/src/agentCatalog.js` — Bündelung der 34 Fach-Prompts zu 14 Agenten für die
  Agenten-Netzwerk-Ansicht (reine Präsentationsschicht, keine Ausführungslogik)
- `server/src/supabaseClient.js` — schreibt Case-Datensätze nach Supabase (best-effort, optional)
- `supabase/migrations/0001_init.sql` — Schema für `cases`/`profiles` inkl. RLS
- `server/.env` — API-Keys (nicht in Git, siehe `.env.example` für die benötigten Variablen)

## Bekannte Grenzen

- **Session-Gedächtnis** (Gesprächsverlauf innerhalb einer Sitzung) liegt im Arbeitsspeicher
  des Node-Prozesses — geht bei Server-Neustart verloren. Für Mehrnutzer-Betrieb später durch
  Redis/DB ersetzbar.
- **Auth**: HTTP Basic Auth schützt weiterhin den gesamten Server (optional, siehe
  `APP_USERNAME`/`APP_PASSWORD`). Supabase Auth im Frontend ist zusätzlich nutzbar, sobald ein
  Supabase-Projekt konfiguriert ist — ohne Konfiguration läuft die App im bisherigen
  Einzelnutzer-Modus ohne Login.
- **Risiko-Radar** zeigt in dieser Version reale, aus dem Fallverlauf abgeleitete Auswertungen
  (keine erfundenen Kennzahlen) — eine quantitative Score-Engine ist als nächster Ausbauschritt
  vorgesehen.
- **Prompt-Katalog** wird weiterhin live von GitHub geladen (`marta-boening/LR_Prompts`) —
  Änderungen an den Prompts dort wirken sich direkt aus, kein Redeploy nötig.
