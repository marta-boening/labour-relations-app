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
