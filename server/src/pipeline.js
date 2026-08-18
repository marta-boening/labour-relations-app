// Portierung der n8n-Workflow-Logik ("Labour Relations Multiagent_final") nach Node.js.
// Jede Funktion entspricht 1:1 einem Node aus dem ursprünglichen Workflow.

import Anthropic from "@anthropic-ai/sdk";
import { marked } from "marked";
import { ROUTER_SYSTEM_PROMPT, PERPLEXITY_TOOL_DESCRIPTION } from "./routerPrompt.js";

const ROUTER_MODEL = "claude-haiku-4-5-20251001";
const EXECUTOR_MODEL = "claude-sonnet-5";
const MAIN_AGENTS = ["lr-taktiker", "ar-lotse", "br-kompass", "mbr-check"];
const MEMORY_WINDOW = 10; // entspricht n8n memoryBufferWindow (letzte N Nachrichten)
const MAX_TOOL_ITERATIONS = 5;
const EXECUTOR_MAX_TOKENS = 32000; // hoch genug, dass selbst lange Vollanalysen (BR-Konter etc.) nicht abschneiden

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-Memory Session-Speicher (entspricht "Session Memory" Node). Pro Prozess,
// kein Cluster-Sharing — für Einzelnutzer ausreichend, später durch Redis/DB ersetzbar.
const sessionMemory = new Map();

// Merkt sich pro Session die ursprüngliche Frage, wenn der Router eine Klärung
// angefordert hat — sonst würde eine kurze Antwort wie "B" ohne Kontext beim
// Router ankommen. Wird nach der nächsten Nachricht wieder gelöscht.
const pendingClarifications = new Map();

let metadataCache = null;
let metadataCacheAt = 0;
const METADATA_TTL_MS = 5 * 60 * 1000;

const promptMdCache = new Map(); // url -> { content, at }
const PROMPT_MD_TTL_MS = 30 * 60 * 1000;

// raw.githubusercontent.com hat gelegentlich IP-basierte 429-Rate-Limits (v.a. auf
// geteilten Sandbox-/CI-IPs). Fallback auf die GitHub Contents API, die einen
// separaten Rate-Limit-Bucket nutzt.
async function fetchGithubRawText(rawUrl) {
  const res = await fetch(rawUrl);
  if (res.ok) return res.text();

  // raw.githubusercontent.com liefert gelegentlich 429/403/503 (IP-Rate-Limits,
  // CDN-Hänger) — dann auf die GitHub Contents API ausweichen (eigener Bucket).
  const match = rawUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (match) {
    const [, owner, repo, ref, filePath] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
    const apiRes = await fetch(apiUrl, { headers: { Accept: "application/vnd.github.raw+json" } });
    if (apiRes.ok) return apiRes.text();
    throw new Error(`GitHub-Load fehlgeschlagen: HTTP ${res.status}, Fallback ebenfalls HTTP ${apiRes.status} (${rawUrl})`);
  }
  throw new Error(`GitHub-Load fehlgeschlagen: HTTP ${res.status} (${rawUrl})`);
}

// ── 1. Load Metadata from GitHub ────────────────────────────────────────────
export async function getMetadata() {
  const now = Date.now();
  if (metadataCache && now - metadataCacheAt < METADATA_TTL_MS) {
    return metadataCache;
  }
  const base = process.env.PROMPTS_BASE_URL;
  const text = await fetchGithubRawText(base + "prompts_metadata.json");
  metadataCache = JSON.parse(text);
  metadataCacheAt = now;
  return metadataCache;
}

// ── 2. Router Agent (Claude Haiku) ──────────────────────────────────────────
async function callRouter(userQuestion, metadata) {
  const promptCatalog = metadata.prompts.map((p) => ({
    id: p.id,
    depth: p.depth,
    hint: p.hint,
    dis: p.disambiguation || "",
  }));

  const userText =
    `Nutzerfrage: ${userQuestion}\n\n` +
    `Verfügbare Prompts:\n${JSON.stringify(promptCatalog, null, 2)}\n\n` +
    `Hauptagenten-IDs: ${JSON.stringify(MAIN_AGENTS)}`;

  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 500,
    temperature: 0,
    system: ROUTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
  });

  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

// ── 3. Parse + Validate Router Output ───────────────────────────────────────
function keywordFallback(question) {
  const q = question.toLowerCase();
  if (q.includes("befrist")) return "befristungs-pilot";
  if (q.includes("arbzg") || (q.includes("arbeitszeit") && !q.includes("mitbestimmung")))
    return "arbeitszeit-kompass";
  if (q.includes("bonus") || q.includes("zielvereinbarung") || q.includes("variable vergütung"))
    return "boni-pruefer";
  if (q.includes("klausel") && !q.includes("bv")) return "klausel-check";
  if (q.includes("abmahn")) return "abmahnungs-assistent";
  if (q.includes("vergleich") && q.includes("klage")) return "vergleichs-stratege";
  if (q.includes("prozess") && (q.includes("klage") || q.includes("gericht"))) return "prozess-lotse";
  if (q.includes("kündig")) return "kundigungs-prufer";
  if (q.includes("agg") || q.includes("diskriminier")) return "agg-check";
  if (q.includes("versetz")) return "versetzungs-check";
  if (q.includes("einigungsstelle")) return "einigungsstellen-check";
  if (q.includes("widerspruch") && q.includes("betriebsrat")) return "br-konter-check";
  if (q.includes("betriebsvereinbarung") || q.includes(" bv ")) return "mbr-architekt";
  if (q.includes("verhandl") && q.includes("betriebsrat")) return "verhandlungs-kompass";
  if (q.includes("mitbestimmung")) return "br-kompass";
  if (q.includes("betriebsrat")) return "br-kompass";
  if (q.includes("risiko")) return "risiko-radar";
  if (q.includes("option") && (q.includes(" vs ") || q.includes("vergleich"))) return "entscheidungs-pilot";
  return null;
}

function buildClarifyResult(question, customQuestion) {
  return {
    prompt_id: "clarify",
    target_agent: "clarify",
    depth: "none",
    confidence: "low",
    user_question: question,
    reasoning: "Frage zu unklar oder mehrdeutig — Rückfrage erforderlich",
    clarification_question:
      customQuestion ||
      "Können Sie Ihr Anliegen bitte konkretisieren? Geht es zum Beispiel um eine Kündigung, eine Versetzung, eine Betriebsratsangelegenheit, eine Vertragsklausel oder ein anderes Thema?",
  };
}

function parseRouterOutput(rawOutput, metadata, userQuestion) {
  const validIds = metadata.prompts.map((p) => p.id);

  let parsed;
  try {
    const cleaned = rawOutput.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch (e) {
    parsed = null;
  }

  let isClarification = false;

  if (!parsed) {
    parsed = buildClarifyResult(userQuestion, null);
    parsed.reasoning = "Parse-Fehler im Router-Output → Klärung statt Default";
    isClarification = true;
  } else if (parsed.prompt_id === "clarify") {
    // "route whenever reasonably possible": auch wenn der Router selbst klären will, zuerst
    // prüfen, ob der Keyword-Fallback trotzdem einen plausiblen Prompt findet — die LLM-
    // Anweisung im Router-Prompt allein reicht nicht zuverlässig, hier greift ein
    // deterministisches Sicherheitsnetz. Nur wenn auch das keinen Treffer liefert, wird
    // tatsächlich geklärt.
    const fbId = keywordFallback(userQuestion);
    if (fbId) {
      const fbMeta = metadata.prompts.find((p) => p.id === fbId);
      parsed = {
        prompt_id: fbId,
        target_agent: MAIN_AGENTS.includes(fbId) ? "main" : "spezialist",
        depth: fbMeta ? fbMeta.depth : "full",
        confidence: "low",
        user_question: userQuestion,
        reasoning: "Router wollte klären, Keyword-Fallback fand plausiblen Treffer → " + fbId,
      };
    } else {
      parsed.target_agent = "clarify";
      parsed.depth = "none";
      parsed.confidence = parsed.confidence || "low";
      parsed.clarification_question =
        parsed.clarification_question || "Können Sie Ihr Anliegen bitte konkretisieren?";
      isClarification = true;
    }
  } else if (!validIds.includes(parsed.prompt_id)) {
    const fbId = keywordFallback(userQuestion);
    if (fbId) {
      const fbMeta = metadata.prompts.find((p) => p.id === fbId);
      parsed = {
        prompt_id: fbId,
        target_agent: MAIN_AGENTS.includes(fbId) ? "main" : "spezialist",
        depth: fbMeta ? fbMeta.depth : "full",
        confidence: "low",
        user_question: userQuestion,
        reasoning: "Fallback (Whitelist): " + (parsed.prompt_id || "?") + " ungültig → Keyword-Match → " + fbId,
      };
    } else {
      parsed = buildClarifyResult(userQuestion, null);
      parsed.reasoning = "Router-ID ungültig und Keyword-Fallback ergab keinen klaren Match → Klärung";
      isClarification = true;
    }
  }
  // Hinweis: Ein gültiger prompt_id-Treffer mit confidence="low" wird bewusst NICHT mehr zur
  // Klärung umgeleitet ("route whenever reasonably possible, clarify only when genuinely
  // necessary") — stattdessen wird lowConfidence unten an buildSystemPrompt() durchgereicht,
  // damit der Fachagent Annahmen transparent kennzeichnet statt nachzufragen.

  if (isClarification) {
    return { ...parsed, isClarification: true };
  }

  return enrichRouting(parsed, metadata);
}

// Reichert ein rohes Routing-Ergebnis (prompt_id/target_agent/depth/confidence/...) um die
// Felder an, die aus dem Prompt-Katalog abgeleitet werden — gemeinsam genutzt vom normalen
// Router-Pfad (parseRouterOutput) und vom direkten Pfad (buildDirectRouting), der den Router
// komplett überspringt.
function enrichRouting(parsed, metadata, { forceLowConfidence } = {}) {
  const promptMeta = metadata.prompts.find((p) => p.id === parsed.prompt_id);
  const baseUrl = metadata._meta.base_url_raw;
  const promptUrl = baseUrl + (promptMeta.file || parsed.prompt_id + "_Prompt.md");

  return {
    ...parsed,
    isClarification: false,
    lowConfidence: forceLowConfidence ?? parsed.confidence === "low",
    promptFile: promptMeta.file || parsed.prompt_id + "_Prompt.md",
    promptUrl,
    promptName: promptMeta.name,
    related: promptMeta.related || [],
    relatedDetails: (promptMeta.related || [])
      .map((rid) => {
        const r = metadata.prompts.find((p) => p.id === rid);
        return r ? { id: r.id, name: r.name, hint: r.hint } : null;
      })
      .filter(Boolean),
  };
}

// ── 3b. Direktes Routing (Router überspringen) ──────────────────────────────
// Wird genutzt, wenn der Nutzer über Prompts/Bibliothek oder Agenten bewusst einen bestimmten
// Prompt gewählt hat ("Prompt starten" / "Fall an X übergeben") — dann soll die gesamte
// Chat-Session direkt an diesen Prompt gebunden bleiben, ohne Router-Aufruf und ohne
// Klärungsschleife. lowConfidence wird trotzdem erzwungen (nicht wegen Unsicherheit über die
// Wahl, sondern damit der Fachagent fehlende Detailinfos als Annahme behandelt statt
// nachzufragen — dieselbe Instruktion wie beim normalen "route whenever possible"-Pfad).
function buildDirectRouting(promptId, metadata, userQuestion) {
  const promptMeta = metadata.prompts.find((p) => p.id === promptId);
  if (!promptMeta) return null;
  return enrichRouting(
    {
      prompt_id: promptId,
      target_agent: MAIN_AGENTS.includes(promptId) ? "main" : "spezialist",
      depth: promptMeta.depth,
      confidence: "high",
      user_question: userQuestion,
      reasoning: "Direkt ausgewählter Prompt — Router und Klärungsschleife bewusst übersprungen.",
    },
    metadata,
    { forceLowConfidence: true }
  );
}

// ── 4. Format Clarification ─────────────────────────────────────────────────
function formatClarification(routing) {
  const question = routing.clarification_question || "Können Sie Ihr Anliegen bitte konkretisieren?";
  const output =
    `❓ **Rückfrage zur besseren Beratung**\n\n${question}\n\n---\n` +
    `*Ich frage nach, weil eine zielgerichtete Antwort eine konkretere Frage braucht. Antworten Sie einfach in der nächsten Nachricht.*`;
  return { output, text: output, html: marked.parse(output), isClarification: true };
}

// ── 5. Load Prompt .md from GitHub + <s>-Block extrahieren ─────────────────
async function loadPromptMarkdown(promptUrl) {
  const cached = promptMdCache.get(promptUrl);
  if (cached && Date.now() - cached.at < PROMPT_MD_TTL_MS) {
    return cached.content;
  }

  const rawContent = await fetchGithubRawText(promptUrl);

  let extracted = rawContent;
  let match = rawContent.match(/```xml\s*<s>[\s\S]*?<\/s>\s*```/m);
  if (match) {
    extracted = match[0].replace(/```xml\s*/g, "").replace(/\s*```/g, "").trim();
  } else {
    match = rawContent.match(/<s>[\s\S]*?<\/s>/m);
    if (match) extracted = match[0];
  }

  promptMdCache.set(promptUrl, { content: extracted, at: Date.now() });
  return extracted;
}

// ── 6. Voyage Embedding ─────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: "voyage-3-large", input: [text], input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage-Embedding fehlgeschlagen: HTTP ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── 7. Qdrant Retrieve ───────────────────────────────────────────────────────
async function qdrantRetrieve(embedding, userId) {
  try {
    const url = `${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}/points/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": process.env.QDRANT_API_KEY },
      body: JSON.stringify({
        query: embedding,
        limit: 5,
        with_payload: true,
        filter: { must: [{ key: "userId", match: { value: userId } }] },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data && data.result && data.result.points) || [];
  } catch (e) {
    return [];
  }
}

// ── 8. Qdrant Store ──────────────────────────────────────────────────────────
async function qdrantStore({ embedding, userId, sessionId, promptId, promptName, userQuestion, answer }) {
  try {
    const url = `${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}/points`;
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "api-key": process.env.QDRANT_API_KEY },
      body: JSON.stringify({
        points: [
          {
            id: Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000),
            vector: embedding,
            payload: {
              userId,
              sessionId,
              promptId,
              promptName,
              question: userQuestion,
              answer,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });
  } catch (e) {
    // wie im n8n-Workflow: Store-Fehler dürfen die Antwort nicht blockieren
  }
}

// ── 9. Build System Prompt ──────────────────────────────────────────────────
function buildSystemPrompt(mdContent, routing, metadata, qdrantPoints) {
  const currentPrompt = metadata.prompts.find((p) => p.id === routing.prompt_id);
  let escalationCandidate = null;
  if (currentPrompt && currentPrompt.depth === "quick" && currentPrompt.related) {
    for (const relId of currentPrompt.related) {
      const rel = metadata.prompts.find((p) => p.id === relId);
      if (rel && rel.depth === "full") {
        escalationCandidate = { id: rel.id, name: rel.name, description: rel.description };
        break;
      }
    }
  }

  let pastContext = "";
  if (qdrantPoints && qdrantPoints.length > 0) {
    pastContext =
      "\n\n---\n\nFRÜHERE FÄLLE / KONTEXT DES BEARBEITERS (sessionübergreifend):\n" +
      qdrantPoints
        .map((p, i) => {
          const pl = p.payload || {};
          return (
            `[${i + 1}] ${pl.timestamp || "früher"} | Prompt: ${pl.promptName || "?"}\n` +
            `   Frage: ${pl.question || ""}\n` +
            `   Antwort (gekürzt): ${(pl.answer || "").slice(0, 500)}...`
          );
        })
        .join("\n\n") +
      "\n\nNutze diesen Kontext, wenn er für die aktuelle Frage relevant ist. Wenn der vorherige Fall denselben Sachverhalt betraf, baue darauf auf statt von vorne anzufangen.";
  }

  const relatedSection =
    routing.relatedDetails.length > 0
      ? "\n\n---\n\nVERFÜGBARE FOLGEPROMPTS (für Empfehlung am Ende):\n" +
        routing.relatedDetails.map((r) => `- [${r.id}] ${r.name}: ${r.description}`).join("\n")
      : "";

  // Der Router routet inzwischen auch bei niedriger Confidence statt nachzufragen ("route
  // whenever reasonably possible") — der Fachagent muss dafür Annahmen transparent machen
  // statt selbst eine Rückfrage zu stellen.
  const lowConfidenceSection = routing.lowConfidence
    ? "\n\n---\n\nHINWEIS ZUM SACHVERHALT:\nDer Sachverhalt war beim Routing nicht vollständig eindeutig oder vollständig " +
      "(z.B. fehlende Details zum Mitarbeiter, zur Historie oder zum genauen Ziel). Frage NICHT nach — " +
      "triff stattdessen plausible, für die Praxis realistische Annahmen, kennzeichne sie explizit " +
      "(z.B. \"Ich gehe davon aus, dass…\") und arbeite die Analyse auf dieser Basis vollständig aus. " +
      "Weise am Ende kurz darauf hin, welche zusätzliche Information die Einschätzung schärfen würde."
    : "";

  const escalationSection = escalationCandidate
    ? "\n\n---\n\nESKALATIONS-OPTION (Quick → Full):\nDieser Prompt ist eine Schnellprüfung. Falls dein Ergebnis Vertiefungsbedarf signalisiert (komplexer Fall, hohes Risiko, viele offene Fragen), weise am Ende deiner Antwort auf folgenden Full-Prompt hin:\n- [" +
      escalationCandidate.id +
      "] " +
      escalationCandidate.name +
      ": " +
      escalationCandidate.description
    : "";

  const outputInstruction =
    "\n\n---\n\nWICHTIG für deine Antwort:\n" +
    "1. Beantworte die Nutzerfrage gemäß deiner Prompt-Spezifikation oben\n" +
    "2. Am ENDE deiner Antwort hänge IMMER folgenden Block an:\n\n" +
    "<<<META>>>\n" +
    "{\n" +
    '  "next_steps": [{"id": "<prompt_id>", "label": "<kurzer Aktionstext>"}],\n' +
    '  "escalation_suggested": <true|false>,\n' +
    '  "escalation_target": "<prompt_id oder null>",\n' +
    '  "escalation_reason": "<warum vertiefen, oder null>"\n' +
    "}\n" +
    "<<<END_META>>>\n\n" +
    "- next_steps: 1-3 sinnvolle Folgeprompts aus der verfügbaren Liste\n" +
    "- escalation_suggested: true wenn aktueller Prompt quick ist UND Vertiefung sinnvoll wäre\n" +
    "- escalation_target: ID des Full-Prompts der eskaliert werden sollte (oder null)\n" +
    "- escalation_reason: kurzer Satz warum Vertiefung sinnvoll wäre (oder null)";

  return mdContent + pastContext + relatedSection + lowConfidenceSection + escalationSection + outputInstruction;
}

// ── 10. Executor Agent (Claude Sonnet + Perplexity-Tool + Session Memory) ──
async function callPerplexity(searchQuery) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: searchQuery }] }),
  });
  if (!res.ok) return `Recherche fehlgeschlagen (HTTP ${res.status}).`;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "Keine Ergebnisse gefunden.";
}

function getSessionMessages(sessionId) {
  return sessionMemory.get(sessionId) || [];
}

function appendSessionMessages(sessionId, newMessages) {
  const existing = sessionMemory.get(sessionId) || [];
  const updated = [...existing, ...newMessages].slice(-MEMORY_WINDOW);
  sessionMemory.set(sessionId, updated);
}

// emit(payload) wird während der Generierung aufgerufen — { type: "delta", text } für jedes
// Text-Stück (streamt die Antwort live zum Frontend statt sie am Stück nach 60-180s zu
// liefern, siehe /api/chat in index.js), { type: "reset" } wenn Text vor einem Tool-Aufruf
// verworfen wird (der zählt nicht zur finalen Antwort), { type: "tool" } während einer
// Perplexity-Recherche. Ohne Streaming würde die Verbindung bei langen Vollanalysen oft
// Renders eigenes Gateway-Zeitlimit überschreiten (502), unabhängig vom Token-Limit.
async function runExecutor(systemPrompt, userQuestion, sessionId, emit = () => {}) {
  const tools = [
    {
      name: "perplexity_web_research",
      description: PERPLEXITY_TOOL_DESCRIPTION,
      input_schema: {
        type: "object",
        properties: {
          searchQuery: {
            type: "string",
            description:
              "Die Suchanfrage in natürlicher Sprache, präzise mit Stichworten, Aktenzeichen, Datumsangaben oder Paragraphen.",
          },
        },
        required: ["searchQuery"],
      },
    },
  ];

  const history = getSessionMessages(sessionId);
  const messages = [...history, { role: "user", content: userQuestion }];

  let finalText = "";
  let truncated = false;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const stream = anthropic.messages.stream({
      model: EXECUTOR_MODEL,
      max_tokens: EXECUTOR_MAX_TOKENS,
      system: systemPrompt,
      messages,
      tools,
    });
    stream.on("text", (delta) => emit({ type: "delta", text: delta }));

    const response = await stream.finalMessage();

    if (response.stop_reason === "tool_use") {
      // Eventuell schon gestreamter Text vor dem Tool-Aufruf gehört nicht zur finalen Antwort
      // (entspricht dem bisherigen "finalText = ''" beim nicht-streamenden Vorgänger).
      emit({ type: "reset" });
      // thinking/redacted_thinking-Blöcke rausfiltern: beim Streamen (messages.stream() +
      // finalMessage()) rekonstruiert der SDK-Snapshot sie in Kombination mit Tool-Use bei
      // diesem Modell fehlerhaft ("each thinking block must contain thinking", HTTP 400) —
      // beim erneuten Senden schlägt der nächste Request sonst fehl. Wir verlassen uns nicht
      // auf explizite Denk-Block-Kontinuität zwischen Turns, daher unbedenklich zu entfernen.
      const assistantContent = response.content.filter(
        (b) => b.type !== "thinking" && b.type !== "redacted_thinking"
      );
      messages.push({ role: "assistant", content: assistantContent });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          emit({ type: "tool", query: block.input.searchQuery });
          const result = await callPerplexity(block.input.searchQuery);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    finalText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    messages.push({ role: "assistant", content: finalText });

    // EXECUTOR_MAX_TOKENS ist bewusst hoch gesetzt, damit das praktisch nie vorkommt. Eine
    // automatische Fortsetzung (frühere Version) ist mit claude-sonnet-5 nicht mehr möglich —
    // das Modell lehnt eine als Assistant-Nachricht vorbelegte Fortsetzung mit HTTP 400 ab
    // ("does not support assistant message prefill"). Bei einer verbleibenden Abschneidung
    // liefern wir die Teilantwort mit Hinweis aus, statt die Anfrage fehlschlagen zu lassen.
    if (response.stop_reason === "max_tokens") {
      truncated = true;
    }
    break;
  }

  if (truncated) {
    finalText += "\n\n*(Hinweis: Diese Antwort wurde aufgrund ihrer Länge gekürzt.)*";
  }

  appendSessionMessages(sessionId, [
    { role: "user", content: userQuestion },
    { role: "assistant", content: finalText },
  ]);

  return finalText;
}

// ── 11. Format Output + Buttons ─────────────────────────────────────────────
function formatOutput(rawAnswer, routing) {
  let cleanAnswer = rawAnswer;
  let meta = { next_steps: [], escalation_suggested: false, escalation_target: null, escalation_reason: null };

  const metaMatch = rawAnswer.match(/<<<META>>>([\s\S]*?)<<<END_META>>>/);
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1].trim());
    } catch (e) {
      // meta bleibt Default
    }
    cleanAnswer = rawAnswer.replace(/<<<META>>>[\s\S]*?<<<END_META>>>/, "").trim();
  }

  let appendix = "";
  if (meta.escalation_suggested && meta.escalation_target) {
    appendix += "\n\n---\n\n### Vertiefung empfohlen\n";
    if (meta.escalation_reason) appendix += `${meta.escalation_reason}\n\n`;
    appendix += `Antworte mit **"Ja, vertiefen mit ${meta.escalation_target}"**, um die Tiefenanalyse zu starten.`;
  }
  if (meta.next_steps && meta.next_steps.length > 0) {
    appendix += "\n\n---\n\n**Mögliche nächste Schritte:**\n";
    appendix += meta.next_steps.map((b) => `- 🔹 \`${b.id}\` — ${b.label}`).join("\n");
    appendix += "\n\n_Tipp: Stelle deine Folgefrage mit Bezug auf einen dieser Prompts._";
  }

  const finalOutput = cleanAnswer + appendix;

  // Die Prompt-Vorlagen strukturieren ihre Antwort mit pseudo-XML-Tags
  // (z.B. <empfehlung>, <checkliste>) — für die Anzeige entfernen, Inhalt bleibt.
  const stripPseudoXml = (s) => s.replace(/<\/?[a-z_]+(?:\s+label="[^"]*")?>/gi, "").trim();
  const displayText = stripPseudoXml(finalOutput);
  const html = marked.parse(displayText);
  // answerHtml: dieselbe Antwort OHNE den angehängten Buttons-Text (next_steps/escalation) —
  // fürs neue React-Frontend, das next_steps/escalation stattdessen als klickbare Buttons aus
  // den strukturierten Feldern unten rendert. `html`/`output` bleiben unverändert für chat.html.
  const answerHtml = marked.parse(stripPseudoXml(cleanAnswer));

  return {
    output: finalOutput,
    text: finalOutput,
    html,
    answerHtml,
    promptUsed: routing.promptName,
    promptId: routing.prompt_id,
    suggestedNextPrompts: meta.next_steps,
    escalation: { suggested: meta.escalation_suggested, target: meta.escalation_target, reason: meta.escalation_reason },
  };
}

// Merkt sich pro Session, ob sie über "Prompt starten"/"Fall an X übergeben" direkt an einen
// Prompt gebunden wurde — dann überspringen auch alle folgenden Nachrichten in derselben
// Session den Router, nicht nur die erste.
const pinnedPrompts = new Map();

// ── Orchestrierung (entspricht dem gesamten n8n-Workflow) ──────────────────
// onEvent(payload): optionaler Callback für Streaming — wird während der Executor-Generierung
// mit { type: "delta", text } / { type: "reset" } / { type: "tool" } aufgerufen (siehe
// runExecutor). Bleibt der Callback weg, läuft alles wie zuvor, nur ohne Zwischenereignisse.
export async function handleChatMessage({ userQuestion, sessionId, userId, promptId, onEvent }) {
  const emit = onEvent || (() => {});
  const metadata = await getMetadata();

  if (promptId) {
    pinnedPrompts.set(sessionId, promptId);
  }
  const pinnedPromptId = pinnedPrompts.get(sessionId);

  if (pinnedPromptId) {
    const routing = buildDirectRouting(pinnedPromptId, metadata, userQuestion);
    if (routing) {
      return runExecution({ routing, metadata, userQuestion, sessionId, userId, emit });
    }
    // Unbekannte/ungültige promptId (z.B. veralteter Katalogstand) → normal weiterrouten.
    pinnedPrompts.delete(sessionId);
  }

  // Falls die letzte Nachricht in dieser Session eine Rückfrage war, ursprüngliche
  // Frage + genaue Rückfrage wieder anhängen — sonst ist eine kurze Antwort wie
  // "B" für einen neuen, kontextlosen Router-Aufruf nicht interpretierbar.
  let effectiveQuestion = userQuestion;
  const pending = pendingClarifications.get(sessionId);
  if (pending) {
    effectiveQuestion =
      `${pending.question}\n\nRückfrage an den Nutzer: ${pending.clarificationAsked}\n\n` +
      `Antwort des Nutzers: ${userQuestion}`;
    pendingClarifications.delete(sessionId);
  }

  const rawRouterOutput = await callRouter(effectiveQuestion, metadata);
  const routing = parseRouterOutput(rawRouterOutput, metadata, effectiveQuestion);

  if (routing.isClarification) {
    pendingClarifications.set(sessionId, {
      question: effectiveQuestion,
      clarificationAsked: routing.clarification_question,
    });
    return formatClarification(routing);
  }

  return runExecution({ routing, metadata, userQuestion: effectiveQuestion, sessionId, userId, emit });
}

async function runExecution({ routing, metadata, userQuestion, sessionId, userId, emit }) {
  const effectiveQuestion = userQuestion;

  const [mdContent, embedding] = await Promise.all([
    loadPromptMarkdown(routing.promptUrl),
    getEmbedding(effectiveQuestion),
  ]);

  const qdrantPoints = await qdrantRetrieve(embedding, userId);
  const systemPrompt = buildSystemPrompt(mdContent, routing, metadata, qdrantPoints);

  const rawAnswer = await runExecutor(systemPrompt, effectiveQuestion, sessionId, emit);
  const formatted = formatOutput(rawAnswer, routing);

  await qdrantStore({
    embedding,
    userId,
    sessionId,
    promptId: routing.prompt_id,
    promptName: routing.promptName,
    userQuestion: effectiveQuestion,
    answer: formatted.output,
  });

  return formatted;
}
