const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:3001";

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

export async function sendChatMessage(params: {
  message: string;
  sessionId: string;
  userId: string;
}): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.output || `HTTP ${res.status}`);
  }
  return res.json();
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
