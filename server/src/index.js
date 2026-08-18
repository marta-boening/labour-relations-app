import "dotenv/config";
import express from "express";
import cors from "cors";
import basicAuth from "express-basic-auth";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { handleChatMessage, getMetadata } from "./pipeline.js";
import { AGENT_CATALOG } from "./agentCatalog.js";
import { supabaseAdmin, storeCase } from "./supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const WEB_DIST = path.join(PROJECT_ROOT, "web", "dist");
const WEB_INDEX_HTML = path.join(WEB_DIST, "index.html");
// Neues React-Frontend (web/) ist die primäre Oberfläche, sobald gebaut (npm run build in
// web/). Ohne Build fällt der Server auf das bisherige chat.html zurück — kein Bruch für
// Deployments, die web/ noch nicht mit ausliefern.
const WEB_BUILD_AVAILABLE = fs.existsSync(WEB_INDEX_HTML);

const REQUIRED_ENV = ["ANTHROPIC_API_KEY", "PERPLEXITY_API_KEY", "VOYAGE_API_KEY", "QDRANT_URL", "QDRANT_API_KEY"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Fehlende Umgebungsvariablen: ${missing.join(", ")}`);
  console.error("Lokal: server/.env.example zu server/.env kopieren und Keys eintragen.");
  console.error("Auf Render: unter 'Environment' im Dashboard setzen.");
  process.exit(1);
}

const app = express();

if (process.env.APP_USERNAME && process.env.APP_PASSWORD) {
  app.use(
    basicAuth({
      users: { [process.env.APP_USERNAME]: process.env.APP_PASSWORD },
      challenge: true,
      realm: "Labour Relations Experte",
    })
  );
} else {
  console.warn(
    "WARNUNG: APP_USERNAME/APP_PASSWORD nicht gesetzt — die App läuft ohne Passwortschutz. " +
      "Nur für rein lokale Nutzung auf localhost vertretbar, niemals bei öffentlichem Deployment."
  );
}

// CORS: das Vite-Dev-Frontend (web/) läuft während der Entwicklung auf einem anderen Port.
app.use(cors());
app.use(express.json());

if (WEB_BUILD_AVAILABLE) {
  app.use(express.static(WEB_DIST));
  // chat.html (Legacy-Oberfläche) bleibt unter /chat.html erreichbar, ist aber nicht mehr
  // die Standardseite — Root-Statics ohne "index"-Option, damit "/" nicht überschrieben wird.
  app.use(express.static(PROJECT_ROOT, { index: false }));
} else {
  console.warn(
    "WARNUNG: web/dist nicht gefunden (noch nicht gebaut: `cd web && npm run build`) — " +
      "Server liefert vorübergehend das alte chat.html als Startseite aus."
  );
  app.use(express.static(PROJECT_ROOT, { index: "chat.html" }));
}

// Server-Sent Events statt einer einzelnen JSON-Antwort: liefert die Executor-Antwort live
// Wort für Wort aus, statt am Stück nach 60-180s. Löst zwei Probleme zugleich — Renders
// eigenes Gateway-Zeitlimit (502 bei sehr langen Vollanalysen, unabhängig vom Token-Limit)
// und die lange Wartezeit ohne jede Rückmeldung im Frontend.
app.post("/api/chat", async (req, res) => {
  const { message, sessionId, userId, promptId } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message fehlt" });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId fehlt" });
  }

  const effectiveUserId = userId || "marta-boening";

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // falls ein Reverse-Proxy davor puffert (z.B. bei Render)
  });
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    const result = await handleChatMessage({
      userQuestion: message.trim(),
      sessionId,
      userId: effectiveUserId,
      // Wenn gesetzt (Nutzer kam über "Prompt starten"/"Fall an X übergeben"): Router für die
      // gesamte Session überspringen, siehe pinnedPrompts in pipeline.js.
      promptId: typeof promptId === "string" && promptId.trim() ? promptId.trim() : undefined,
      onEvent: send,
    });
    send({ type: "done", ...result });
    res.end();

    // Case-Historie für Verlauf/Fälle, Risiko-Radar, Agenten-Kennzahlen — darf die bereits
    // gesendete Antwort nicht verzögern oder blockieren (best-effort, wie qdrantStore()).
    storeCase({ userId: effectiveUserId, sessionId, userQuestion: message.trim(), result }).catch(
      () => {}
    );
  } catch (err) {
    console.error("Fehler in handleChatMessage:", err);
    send({ type: "error", message: `Fehler bei der Verarbeitung: ${err.message}` });
    res.end();
  }
});

// Prompt-Katalog roh weiterreichen (bereits über GitHub geladen + gecacht in pipeline.js) —
// für die Prompts/Bibliothek-Seite im neuen Frontend.
app.get("/api/prompts", async (req, res) => {
  try {
    const metadata = await getMetadata();
    res.json(metadata);
  } catch (err) {
    console.error("Fehler in GET /api/prompts:", err);
    res.status(500).json({ error: `Prompt-Katalog konnte nicht geladen werden: ${err.message}` });
  }
});

// Die 14 kuratierten Agenten (agentCatalog.js) angereichert mit Prompt-Details aus dem Katalog
// und, sofern Supabase konfiguriert ist, echten Fallzahlen je Agent.
app.get("/api/agents", async (req, res) => {
  try {
    const metadata = await getMetadata();
    const promptsById = new Map(metadata.prompts.map((p) => [p.id, p]));

    const caseCounts = new Map();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from("cases").select("agent_id");
      if (!error && data) {
        for (const row of data) {
          if (!row.agent_id) continue;
          caseCounts.set(row.agent_id, (caseCounts.get(row.agent_id) || 0) + 1);
        }
      }
    }

    const agents = AGENT_CATALOG.map((agent) => ({
      id: agent.id,
      name: agent.name,
      category: agent.category,
      description: agent.description,
      promptCount: agent.promptIds.length,
      caseCount: caseCounts.get(agent.id) || 0,
      prompts: agent.promptIds
        .map((id) => promptsById.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p.id, name: p.name, depth: p.depth, hint: p.hint })),
    }));

    res.json({ agents });
  } catch (err) {
    console.error("Fehler in GET /api/agents:", err);
    res.status(500).json({ error: `Agenten konnten nicht geladen werden: ${err.message}` });
  }
});

// SPA-Fallback: React Router übernimmt clientseitig (/chat, /agents, /prompts, ...) — bei
// direktem Aufruf/Reload einer solchen URL muss weiterhin index.html ausgeliefert werden.
if (WEB_BUILD_AVAILABLE) {
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(WEB_INDEX_HTML);
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Labour Relations App läuft auf http://localhost:${PORT}`);
});
