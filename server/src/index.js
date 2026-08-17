import "dotenv/config";
import express from "express";
import basicAuth from "express-basic-auth";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleChatMessage } from "./pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

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

app.use(express.json());
app.use(express.static(PROJECT_ROOT, { index: "chat.html" }));

app.post("/api/chat", async (req, res) => {
  const { message, sessionId, userId } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message fehlt" });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId fehlt" });
  }

  try {
    const result = await handleChatMessage({
      userQuestion: message.trim(),
      sessionId,
      userId: userId || "marta-boening",
    });
    res.json(result);
  } catch (err) {
    console.error("Fehler in handleChatMessage:", err);
    res.status(500).json({ output: `Fehler bei der Verarbeitung: ${err.message}`, error: true });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Labour Relations App läuft auf http://localhost:${PORT}`);
});
