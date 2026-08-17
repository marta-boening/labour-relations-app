# Technische Dokumentation — Labour Relations App

Stand: 2026-08-17

> **Hinweis zu Secrets:** Dieses Dokument enthält bewusst **keine echten API-Schlüssel,
> Passwörter oder Tokens** — nur die Namen der benötigten Umgebungsvariablen. Die
> tatsächlichen Werte liegen ausschließlich in `server/.env` (lokal, nicht in Git) bzw.
> im "Environment"-Tab des Render-Dashboards (Produktion). Falls dieses Dokument geteilt
> wird, ist das unbedenklich — es verrät keine Zugangsdaten.

## 1. Überblick

Multi-Agenten-Webapp für Labour Relations. Backend ist eine eigenständige Portierung des
ursprünglichen n8n-Workflows `Labour Relations Multiagent_final` zu einem Node.js/Express-Server
— kein n8n mehr im Einsatz, die komplette Routing-, RAG- und Agenten-Logik läuft als Code.
Frontend ist eine React-Anwendung (`web/`, Vite + TypeScript + Tailwind) mit sieben Bereichen:
Chat, Verlauf/Fälle, Prompts/Bibliothek, Agenten, Risiko-Radar, Wissen, Einstellungen.

**Zweck:** Fachassistent für Arbeitsrecht/Labour Relations. Beantwortet Fragen anhand von 34
spezialisierten Prompt-Vorlagen (Kündigung, Betriebsrat, Mitbestimmung, AGG, Befristung, Boni, …),
gebündelt zu 14 fachlichen Agenten (`server/src/agentCatalog.js`), mit Web-Recherche-Tool und
sitzungsübergreifendem Gedächtnis früherer Fälle. Supabase ist optional als Nutzer-/Falldatenbank
angebunden (Login, strukturierte Fallhistorie fürs Frontend) — ohne konfiguriertes Supabase-Projekt
läuft die App unverändert im bisherigen Einzelnutzer-Modus.

## 2. Architektur

```
Browser
   │  React-Frontend (web/, oder Legacy chat.html unter /chat.html)
   │  POST /api/chat  { message, sessionId, userId }
   │  GET  /api/prompts, GET /api/agents  (Prompts/Bibliothek, Agenten-Seite)
   ▼
Express-Server (server/src/index.js)
   │  Basic Auth (falls APP_USERNAME/APP_PASSWORD gesetzt)
   │  Statisches Ausliefern von web/dist (Fallback: chat.html, falls web/ nicht gebaut)
   ▼
Pipeline (server/src/pipeline.js) — handleChatMessage()
   │
   ├─ 1. getMetadata()          → GitHub: prompts_metadata.json (Katalog aller Prompts)
   ├─ 2. callRouter()           → Anthropic Claude Haiku: wählt passenden Prompt oder "clarify"
   ├─ 3. parseRouterOutput()    → validiert gegen Whitelist, Keyword-Fallback bei Fehlern
   │
   ├─ (Klärungspfad, Ausnahmefall) formatClarification() → Rückfrage an Nutzer, Kontext gemerkt
   │                                          für die nächste Nachricht
   │
   └─ (Ausführungspfad, Regelfall)
       ├─ 4. loadPromptMarkdown()  → GitHub: <PromptName>_Prompt.md (Fachinstruktion)
       ├─ 5. getEmbedding()        → Voyage AI: Embedding der Nutzerfrage
       ├─ 6. qdrantRetrieve()      → Qdrant: ähnliche frühere Fälle desselben Nutzers
       ├─ 7. buildSystemPrompt()   → kombiniert Prompt-MD + frühere Fälle + Meta-Anweisungen
       ├─ 8. runExecutor()         → Anthropic Claude Sonnet, mit Tool-Use-Loop:
       │                              kann "Perplexity Web Research"-Tool aufrufen
       │                              (aktuelle Urteile/Gesetze/Statistiken)
       ├─ 9. formatOutput()        → extrahiert Meta-Block (Folgeprompts, Eskalation),
       │                              rendert Markdown → HTML (inkl. answerHtml ohne Meta-Anhang
       │                              fürs React-Frontend, das Folgeprompts als Buttons rendert)
       └─ 10. qdrantStore()        → speichert Frage+Antwort als Vektor für künftige Fälle

Nach der Antwort (außerhalb der Pipeline, in index.js): storeCase() schreibt best-effort einen
Case-Datensatz nach Supabase (server/src/supabaseClient.js) — blockiert die Antwort nicht, siehe
Abschnitt 4.
```

**Routing-Prinzip ("route whenever reasonably possible, clarify only when genuinely
necessary"):** Der Router (`routerPrompt.js`) routet auch bei unvollständigem Sachverhalt oder
niedriger Confidence auf den plausibelsten Prompt, statt nachzufragen — eine Rückfrage
(`prompt_id="clarify"`) ist die Ausnahme, nicht der Standardfall bei Unsicherheit. Bei
`confidence="low"` reicht `parseRouterOutput()` das Flag `lowConfidence` an `buildSystemPrompt()`
durch; der Fachagent wird angewiesen, fehlende Informationen als transparent gekennzeichnete
Annahme zu behandeln statt selbst nachzufragen. Echte Rückfragen bleiben nur für Fälle, in denen
kein Prompt im Katalog auch nur ansatzweise zum Thema passt oder das Thema selbst unklar ist.

## 3. Externe Schnittstellen

| Dienst | Zweck | Auth-Methode | Env-Variable(n) |
|---|---|---|---|
| **Anthropic API** | Router (Claude Haiku 4.5) + Executor (Claude Sonnet 5) | API-Key im Header | `ANTHROPIC_API_KEY` |
| **Perplexity API** | Web-Recherche-Tool der Executor-Agenten (`sonar`-Modell) | Bearer-Token | `PERPLEXITY_API_KEY` |
| **Voyage AI API** | Text-Embeddings (`voyage-3-large`, 1024 Dimensionen) für RAG | Bearer-Token | `VOYAGE_API_KEY` |
| **Qdrant Cloud** | Vektordatenbank, Collection `lr_cases`, Cosine-Distanz | Header `api-key` | `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` |
| **GitHub** (`raw.githubusercontent.com` + Fallback `api.github.com`) | Prompt-Katalog + Fachinstruktionen (Repo `marta-boening/LR_Prompts`, öffentlich) | keine (öffentliches Repo) | `PROMPTS_BASE_URL` |
| **Supabase** (optional) | Login (Supabase Auth im Frontend) + strukturierte Fallhistorie (`cases`-Tabelle, RLS) | Service-Role-Key server-seitig, anon Key im Frontend | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Server); `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Frontend) |

### GitHub-Fallback-Logik
`raw.githubusercontent.com` liefert gelegentlich `429`/`403`/`503` bei IP-basierter
Drosselung. Bei jedem Fehlerstatus weicht der Server automatisch auf die GitHub
Contents API (`api.github.com/repos/.../contents/...`) aus — eigener Rate-Limit-Bucket,
kein Auth nötig da das Repo öffentlich ist. Siehe `fetchGithubRawText()` in
`pipeline.js`.

## 4. Eigene Schnittstellen (vom Server bereitgestellt)

| Route | Methode | Beschreibung |
|---|---|---|
| `/` | GET | Liefert `web/dist` (React-App), falls gebaut — sonst Fallback `chat.html` |
| `/chat.html` | GET | Legacy-Chat-Oberfläche, immer erreichbar (statisch, `express.static(PROJECT_ROOT)`) |
| `/api/chat` | POST | Nimmt `{ message, sessionId, userId }` entgegen, gibt `{ output, html, answerHtml, promptId, promptUsed, suggestedNextPrompts, escalation, ... }` zurück. Schreibt zusätzlich best-effort einen Case-Datensatz nach Supabase (falls konfiguriert). |
| `/api/prompts` | GET | Gibt den vollständigen Prompt-Katalog zurück (`getMetadata()`, GitHub-gecacht) — Grundlage der Prompts/Bibliothek-Seite |
| `/api/agents` | GET | Gibt die 14 kuratierten Agenten zurück, angereichert mit Prompt-Details und (falls Supabase konfiguriert) echten Fallzahlen je Agent |
| `/*` (alles außer `/api/*`) | GET | SPA-Fallback: liefert `web/dist/index.html`, damit React-Router-Routen (`/agents`, `/prompts`, …) auch bei direktem Aufruf/Reload funktionieren (nur aktiv, wenn `web/dist` existiert) |

Alle Routen liegen hinter HTTP Basic Auth, sobald `APP_USERNAME`/`APP_PASSWORD`
gesetzt sind (siehe Abschnitt 6). CORS ist aktiv (`cors()`-Middleware), damit das
Vite-Dev-Frontend (Port 5173) während der Entwicklung auf den Server (Port 3001) zugreifen kann.

## 5. Umgebungsvariablen — vollständige Referenz

Alle Namen aus `server/.env.example`. **Werte nie in Doku/Chat/Git — nur in `.env`
(lokal) oder Render-Dashboard (Produktion).**

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `ANTHROPIC_API_KEY` | ja | Claude-API-Zugang (Router + Executor) |
| `PERPLEXITY_API_KEY` | ja | Web-Recherche-Tool |
| `VOYAGE_API_KEY` | ja | Embeddings für RAG |
| `QDRANT_URL` | ja | Cluster-Adresse (kein Geheimnis an sich, aber projektspezifisch) |
| `QDRANT_API_KEY` | ja | Zugang zum Qdrant-Cluster |
| `QDRANT_COLLECTION` | nein (Default `lr_cases`) | Name der Vektor-Collection |
| `PROMPTS_BASE_URL` | nein (Default gesetzt) | Basis-URL des Prompt-Repos |
| `APP_USERNAME` | nein, aber Pflicht bei öffentlichem Deployment | Basic-Auth-Nutzername |
| `APP_PASSWORD` | nein, aber Pflicht bei öffentlichem Deployment | Basic-Auth-Passwort |
| `PORT` | nein (Default `3001`, Render setzt automatisch) | Server-Port |
| `SUPABASE_URL` | nein (ohne bleibt Fallhistorie leer) | Supabase-Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | nein | Service-Role-Key, nur server-seitig — umgeht RLS bewusst zum Schreiben |

Frontend (`web/.env`, siehe `web/.env.example` — separat von `server/.env`, da im Browser geladen):

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `VITE_API_BASE_URL` | nein (Default `http://localhost:3001`) | Basis-URL des Backends |
| `VITE_SUPABASE_URL` | nein | Supabase-Projekt-URL (identisch zu `SUPABASE_URL`) |
| `VITE_SUPABASE_ANON_KEY` | nein | anon/public Key — sicher fürs Frontend, RLS beschränkt Zugriff auf eigene Daten |

## 6. Sicherheit

- **Passwortschutz:** HTTP Basic Auth via `express-basic-auth`, aktiv sobald
  `APP_USERNAME`+`APP_PASSWORD` gesetzt sind. Ohne diese Variablen startet der Server
  mit einer Konsolen-Warnung ungeschützt — nur für `localhost` vertretbar.
- **HTTPS:** Wird bei Deployment über Render automatisch bereitgestellt (Let's Encrypt).
- **Secrets:** Liegen ausschließlich in `.env` (lokal, per `.gitignore` von Git
  ausgeschlossen) bzw. im Render-Environment-Tab. Nie im Code, nie in diesem Dokument.
- **Login (optional, additiv):** Sobald `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` gesetzt
  sind, zeigt das Frontend einen Supabase-Auth-Login (E-Mail/Passwort) vor der App. Der
  Basic-Auth-Schutz des gesamten Servers bleibt davon unberührt und aktiv — Supabase Auth ist
  eine zusätzliche Ebene fürs Frontend (Zuordnung von Fällen zu Nutzern), keine Ablösung.
  Backend-seitig wird die Supabase-Session nicht verifiziert (kein JWT-Check auf `/api/*`) — für
  den jetzigen Einzelnutzer-/Kleinteam-Betrieb ausreichend, für echten Mehrbenutzerbetrieb später
  nachzurüsten.
- **Row Level Security:** Die `cases`/`profiles`-Tabellen (siehe `supabase/migrations/0001_init.sql`)
  sind per RLS auf `auth.uid() = user_id` beschränkt — ein Nutzer sieht ausschließlich eigene
  Fälle. Das Backend schreibt mit dem Service-Role-Key (umgeht RLS bewusst, analog zum
  bestehenden Qdrant-Store-Muster).

## 7. Zustandsspeicherung (State)

| Was | Wo | Persistenz |
|---|---|---|
| Gesprächsverlauf pro Sitzung (letzte 10 Nachrichten) | In-Memory `Map` im Node-Prozess (`sessionMemory`) | Geht bei Server-Neustart verloren |
| Offene Klärungsfragen pro Sitzung | In-Memory `Map` (`pendingClarifications`) | Geht bei Server-Neustart verloren |
| Prompt-Katalog (Metadata) | In-Memory-Cache, TTL 5 Min. | Wird periodisch neu von GitHub geladen |
| Einzelne Prompt-Dateien (.md) | In-Memory-Cache, TTL 30 Min. | Wird periodisch neu von GitHub geladen |
| Frühere Fälle (Frage+Antwort+Embedding, für RAG-Ähnlichkeitssuche) | Qdrant Cloud, Collection `lr_cases` | Dauerhaft, überlebt Server-Neustarts |
| Strukturierte Fallhistorie (fürs Frontend: Verlauf/Fälle, Risiko-Radar, Agenten-Kennzahlen) | Supabase, Tabelle `cases` (optional) | Dauerhaft, falls Supabase konfiguriert — sonst bleibt die Historie leer |

Da Session-Daten nur im Arbeitsspeicher liegen, funktioniert das **nur mit einer
einzigen laufenden Server-Instanz**. Bei horizontaler Skalierung (mehrere Instanzen
hinter einem Load-Balancer) müsste dies durch Redis oder eine DB ersetzt werden.

## 8. Modell-Konfiguration

| Rolle | Modell | max_tokens | Begründung |
|---|---|---|---|
| Router | `claude-haiku-4-5-20251001` | 500 | Schnell/günstig, reine Klassifikationsaufgabe |
| Executor | `claude-sonnet-5` | 8000 (+ bis zu 2 automatische Fortsetzungen bei Abschneiden) | Balance aus Gründlichkeit und Antwortzeit |

**Fortsetzungslogik:** Erreicht Claude das Token-Limit mitten im Text
(`stop_reason: "max_tokens"`), fordert der Server automatisch eine nahtlose Fortsetzung
an, statt die abgeschnittene Antwort auszuliefern (siehe `runExecutor()`).

## 9. Datei-Struktur

```
Chatbot_n8n_Agent/
├── chat.html                    Legacy-Chat-Oberfläche (kein Build-Schritt, Fallback)
├── README.md                    Kurzanleitung Start/Stop
├── TECHNICAL.md                 Dieses Dokument
├── .gitignore
├── supabase/
│   └── migrations/
│       └── 0001_init.sql        Schema: cases, profiles, RLS-Policies
├── web/                          React-Frontend (Vite + TypeScript + Tailwind)
│   ├── .env.example              Vorlage für VITE_*-Variablen
│   ├── src/
│   │   ├── App.tsx                Routing (7 Bereiche) + Auth-Gate
│   │   ├── components/AppShell.tsx  Sidebar-Layout (Petrol-Sand)
│   │   ├── components/ui/         Button/Card/Badge/Input (shadcn-Stil)
│   │   ├── lib/api.ts             Fetch-Wrapper für /api/chat, /api/prompts, /api/agents
│   │   ├── lib/cases.ts           Supabase-Query für die Fallhistorie
│   │   ├── lib/supabaseClient.ts  Supabase-Client (anon Key)
│   │   ├── lib/useAuth.tsx        Auth-Context (Supabase Auth, Fallback-Einzelnutzer-Modus)
│   │   └── pages/                 ChatPage, CasesPage, PromptsPage, AgentsPage,
│   │                               RiskRadarPage, KnowledgePage, SettingsPage
│   └── dist/                      Produktions-Build (generiert, nicht in Git)
└── server/
    ├── .env.example             Vorlage für Umgebungsvariablen (keine echten Werte)
    ├── .env                     Echte Werte, NICHT in Git
    ├── package.json
    └── src/
        ├── index.js             Express-Server, Auth, Routing, Static-Serving (web/dist)
        ├── pipeline.js          Komplette Workflow-Logik (Router→RAG→Executor→Format)
        ├── routerPrompt.js      System-Prompt des Router-Agenten (aus n8n übernommen, überarbeitet)
        ├── agentCatalog.js      34 Prompts → 14 Agenten (Präsentationsschicht)
        └── supabaseClient.js    Supabase-Anbindung (Service-Role, best-effort Case-Schreiben)
```

## 10. Deployment (Produktion)

Gehostet auf **Render** (Web Service):
- Root Directory: Repository-Root (nicht mehr `server`, da auch `web/` gebaut werden muss)
- Build Command: `cd web && npm install && npm run build && cd ../server && npm install`
- Start Command: `cd server && npm start`
- Umgebungsvariablen: siehe Abschnitt 5, eingetragen im Render-Dashboard
  ("Environment"-Tab) — inkl. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, falls Supabase
  genutzt wird. `VITE_*`-Variablen müssen bereits zur Build-Zeit gesetzt sein (Vite bettet sie
  beim Build ein), nicht erst zur Laufzeit.
- Automatisches HTTPS über Render-Subdomain
- Free-Tier-Hinweis: Dienst schläft nach Inaktivität, erster Request danach ~30–50s
- Ohne Build-Schritt für `web/` (z.B. bei einem noch nicht angepassten Deployment) liefert der
  Server automatisch `chat.html` als Fallback aus — kein harter Bruch.

## 11. Bekannte Grenzen

- Kein Backend-seitiger Multi-User-Zugriffsschutz über Basic Auth hinaus (Supabase Auth schützt
  nur, welche Daten das Frontend anzeigt/schreibt — nicht die API-Routen selbst)
- Session-Gedächtnis nicht persistent über Server-Neustarts hinweg
- Risiko-Radar zeigt reale, aber noch nicht quantitativ bewertete Fälle (keine Score-Engine,
  siehe README "Bekannte Grenzen")
- Keine automatisierten Tests
- GitHub-Prompt-Repo ist eine externe Abhängigkeit ohne lokales Backup — bei
  Nichterreichbarkeit schlägt die Anfrage fehl (kein Cache-Fallback über die TTL hinaus)
