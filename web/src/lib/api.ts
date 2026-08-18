// Ohne VITE_API_BASE_URL: relative Pfade ("/api/...") — funktioniert automatisch sowohl in
// Produktion (Server liefert Frontend + API von derselben Adresse) als auch lokal, wenn der
// gebaute Build direkt vom Express-Server ausgeliefert wird. Nur der separate Vite-Dev-Server
// (anderer Port) braucht die explizite absolute URL aus web/.env.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";

export interface ChatResponse {
  output: string;
  text: string;
  html: string;
  answerHtml?: string;
  promptUsed?: string;
  promptId?: string;
  suggestedNextPrompts?: { id: string; label: string }[];
  escalation?: { suggested: boolean; target: string | null; reason: string | null };
  isClarification?: boolean;
  error?: boolean;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "tool"; query: string };

// Liest die Antwort als Server-Sent-Events statt eines einzelnen JSON-Blocks — die Executor-
// Antwort trifft live Wort für Wort ein statt am Stück nach 60-180s. Vermeidet außerdem, dass
// Renders eigenes Gateway-Zeitlimit bei sehr langen Vollanalysen zuschlägt (502).
// onEvent bekommt Zwischenereignisse (delta/reset/tool) für die progressive Anzeige; das
// Promise löst erst mit der finalen, vollständig formatierten Antwort auf.
export async function sendChatMessage(
  params: { message: string; sessionId: string; userId: string; promptId?: string },
  onEvent?: (event: ChatStreamEvent) => void
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Backend sendet bei Fehlern { output: "<Fehlertext>", error: true } — error ist ein reines
    // Bool-Flag, kein Text. body.output enthält die eigentliche, lesbare Fehlermeldung.
    const message =
      body.output || (typeof body.error === "string" ? body.error : null) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (!res.body) throw new Error("Keine Antwort vom Server erhalten.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ChatResponse | null = null;

  // Verarbeitet vollständige "data: {...}"-Blöcke aus dem Puffer; der letzte, evtl. noch
  // unvollständige Rest bleibt für den nächsten Durchlauf im Puffer stehen.
  const processBuffer = (isFinalChunk: boolean) => {
    const parts = buffer.split("\n\n");
    buffer = isFinalChunk ? "" : parts.pop() ?? "";
    // Bei Verbindungsabbruch (isFinalChunk) auch ein zuletzt evtl. ohne trennendes "\n\n"
    // angekommenes Event noch mitnehmen, statt es stillschweigend zu verwerfen — sonst zeigt
    // die App bei einem Fehler direkt am Verbindungsende nur die generische Fallback-Meldung
    // statt der echten (z.B. "Guthaben zu niedrig").
    const toProcess = isFinalChunk ? parts.concat(buffer ? [buffer] : []) : parts;
    for (const part of toProcess) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (payload.type === "done") {
        finalResult = payload as unknown as ChatResponse;
      } else if (payload.type === "error") {
        throw new Error((payload.message as string) || "Unbekannter Fehler bei der Verarbeitung.");
      } else {
        onEvent?.(payload as ChatStreamEvent);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      processBuffer(true);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    processBuffer(false);
  }

  if (!finalResult) {
    throw new Error("Verbindung wurde beendet, bevor eine vollständige Antwort empfangen wurde.");
  }
  return finalResult;
}

export interface PromptEntry {
  id: string;
  name: string;
  file?: string;
  depth: "quick" | "full";
  hint: string;
  disambiguation?: string;
  related?: string[];
}

export interface PromptCatalog {
  _meta: { version: string; source_repo: string; last_sync: string };
  prompts: PromptEntry[];
}

export async function fetchPrompts(): Promise<PromptCatalog> {
  const res = await fetch(`${API_BASE}/api/prompts`);
  if (!res.ok) throw new Error(`Prompt-Katalog: HTTP ${res.status}`);
  return res.json();
}

export interface AgentSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  promptCount: number;
  caseCount: number;
  prompts: { id: string; name: string; depth: string; hint: string }[];
}

export async function fetchAgents(): Promise<{ agents: AgentSummary[] }> {
  const res = await fetch(`${API_BASE}/api/agents`);
  if (!res.ok) throw new Error(`Agenten: HTTP ${res.status}`);
  return res.json();
}
