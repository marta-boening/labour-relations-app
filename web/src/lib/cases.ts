import { supabase } from "@/lib/supabaseClient";

export interface CaseRow {
  id: string;
  user_id: string;
  session_id: string;
  prompt_id: string;
  prompt_name: string | null;
  agent_id: string | null;
  title: string | null;
  question: string;
  answer: string;
  answer_html: string | null;
  escalation_suggested: boolean;
  escalation_target: string | null;
  created_at: string;
}

// Liest die Fallhistorie direkt aus Supabase (RLS filtert bereits auf den eingeloggten Nutzer,
// siehe supabase/migrations/0001_init.sql). Ohne konfiguriertes Supabase-Projekt: leere Liste.
export async function fetchCases(limit = 200): Promise<CaseRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Fehler beim Laden der Fälle:", error.message);
    return [];
  }
  return data as CaseRow[];
}

export interface CaseThread {
  sessionId: string;
  title: string;
  promptId: string;
  promptName: string | null;
  createdAt: string; // Zeitpunkt der letzten Nachricht in diesem Fall
  cases: CaseRow[]; // chronologisch, älteste zuerst
}

// Gruppiert einzelne Case-Zeilen (je eine pro Chat-Antwort) nach session_id zu einem
// zusammenhängenden Fall-Verlauf — ein "Fall fortsetzen" erzeugt mehrere Zeilen mit derselben
// session_id (siehe ChatPage.tsx: sessionId wird beim Fortsetzen wiederverwendet statt neu
// erzeugt), die hier als EIN Fall mit mehreren Nachrichten dargestellt werden sollen, statt als
// mehrere separate Fälle in der Liste.
export function groupCasesBySession(cases: CaseRow[]): CaseThread[] {
  const bySession = new Map<string, CaseRow[]>();
  for (const c of cases) {
    const list = bySession.get(c.session_id);
    if (list) list.push(c);
    else bySession.set(c.session_id, [c]);
  }

  const threads: CaseThread[] = [];
  for (const [sessionId, rows] of bySession) {
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    threads.push({
      sessionId,
      title: first.title || first.prompt_id,
      promptId: last.prompt_id,
      promptName: last.prompt_name,
      createdAt: last.created_at,
      cases: sorted,
    });
  }

  threads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return threads;
}
