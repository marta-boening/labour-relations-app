# Labour Relations App

Eigenständige Version des ursprünglichen n8n-Workflows ("Labour Relations Multiagent_final") —
läuft ohne n8n, direkt als Node.js-Server.

## Starten

```bash
cd server
npm start
```

Dann im Browser öffnen: http://localhost:3001

## Stoppen

Im Terminal, in dem der Server läuft: `Ctrl + C`

Falls er im Hintergrund läuft (z.B. über `nohup`):
```bash
pkill -f "node src/index.js"
```

## Struktur

- `chat.html` — Chat-Oberfläche (unverändert vom ursprünglichen Design, spricht jetzt den
  lokalen Server statt n8n an)
- `server/src/pipeline.js` — Kompletter Workflow als Code: Router → RAG (Qdrant/Voyage) →
  Executor-Agent (Claude + Perplexity-Tool) → Formatierung
- `server/src/routerPrompt.js` — Router-System-Prompt (1:1 aus dem n8n-Workflow übernommen)
- `server/.env` — API-Keys (nicht in Git, siehe `.env.example` für die benötigten Variablen)

## Bekannte Grenzen (bewusste Vereinfachungen für "erstmal nur ich")

- **Session-Gedächtnis** (Gesprächsverlauf innerhalb einer Sitzung) liegt im Arbeitsspeicher
  des Node-Prozesses — geht bei Server-Neustart verloren. Für Mehrnutzer-Betrieb später durch
  Redis/DB ersetzbar.
- **Kein Login/Auth** — jeder mit Zugriff auf `localhost:3001` kann den Chat nutzen. Für den
  jetzigen Einzelnutzer-Betrieb ok, für breiteren Zugriff später nachzurüsten.
- **Prompt-Katalog** wird weiterhin live von GitHub geladen (`marta-boening/LR_Prompts`) —
  Änderungen an den Prompts dort wirken sich direkt aus, kein Redeploy nötig.
