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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-Memory Session-Speicher (entspricht "Session Memory" Node). Pro Prozess,
// kein Cluster-Sharing — für Einzelnutzer ausreichend, später durch Redis/DB ersetzbar.
const sessionMemory = new Map();

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

  if (res.status === 429 || res.status === 403) {
    const match = rawUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    if (match) {
      const [, owner, repo, ref, filePath] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;
      const apiRes = await fetch(apiUrl, { headers: { Accept: "application/vnd.github.raw+json" } });
      if (apiRes.ok) return apiRes.text();
      throw new Error(`GitHub-Fallback fehlgeschlagen: HTTP ${apiRes.status}`);
    }
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
    parsed.target_agent = "clarify";
    parsed.depth = "none";
    parsed.confidence = parsed.confidence || "low";
    parsed.clarification_question =
      parsed.clarification_question || "Können Sie Ihr Anliegen bitte konkretisieren?";
    isClarification = true;
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
  } else if (parsed.confidence === "low" && parsed.prompt_id !== "clarify") {
    const fbMeta = metadata.prompts.find((p) => p.id === parsed.prompt_id);
    const alternatives = fbMeta && fbMeta.related ? fbMeta.related.slice(0, 2) : [];
    const altText =
      alternatives.length > 0
        ? ` Mögliche Richtungen: ${parsed.prompt_id}` + alternatives.map((a) => `, ${a}`).join("") + "."
        : "";
    parsed = buildClarifyResult(
      userQuestion,
      `Ich bin nicht ganz sicher, wie ich Ihre Frage am besten einordnen soll.${altText} Können Sie kurz konkretisieren, was genau Sie wissen möchten?`
    );
    parsed.reasoning = "Router-Confidence low bei gültiger ID → vorsichtshalber Klärung";
    isClarification = true;
  }

  if (isClarification) {
    return { ...parsed, isClarification: true };
  }

  const promptMeta = metadata.prompts.find((p) => p.id === parsed.prompt_id);
  const baseUrl = metadata._meta.base_url_raw;
  const promptUrl = baseUrl + (promptMeta.file || parsed.prompt_id + "_Prompt.md");

  return {
    ...parsed,
    isClarification: false,
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

  return mdContent + pastContext + relatedSection + escalationSection + outputInstruction;
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

async function runExecutor(systemPrompt, userQuestion, sessionId) {
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
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: EXECUTOR_MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages,
      tools,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await callPerplexity(block.input.searchQuery);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    finalText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    messages.push({ role: "assistant", content: finalText });
    break;
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
  const displayText = finalOutput.replace(/<\/?[a-z_]+(?:\s+label="[^"]*")?>/gi, "").trim();
  const html = marked.parse(displayText);

  return {
    output: finalOutput,
    text: finalOutput,
    html,
    promptUsed: routing.promptName,
    promptId: routing.prompt_id,
    suggestedNextPrompts: meta.next_steps,
    escalation: { suggested: meta.escalation_suggested, target: meta.escalation_target, reason: meta.escalation_reason },
  };
}

// ── Orchestrierung (entspricht dem gesamten n8n-Workflow) ──────────────────
export async function handleChatMessage({ userQuestion, sessionId, userId }) {
  const metadata = await getMetadata();

  const rawRouterOutput = await callRouter(userQuestion, metadata);
  const routing = parseRouterOutput(rawRouterOutput, metadata, userQuestion);

  if (routing.isClarification) {
    return formatClarification(routing);
  }

  const [mdContent, embedding] = await Promise.all([
    loadPromptMarkdown(routing.promptUrl),
    getEmbedding(userQuestion),
  ]);

  const qdrantPoints = await qdrantRetrieve(embedding, userId);
  const systemPrompt = buildSystemPrompt(mdContent, routing, metadata, qdrantPoints);

  const rawAnswer = await runExecutor(systemPrompt, userQuestion, sessionId);
  const formatted = formatOutput(rawAnswer, routing);

  await qdrantStore({
    embedding,
    userId,
    sessionId,
    promptId: routing.prompt_id,
    promptName: routing.promptName,
    userQuestion,
    answer: formatted.output,
  });

  return formatted;
}
