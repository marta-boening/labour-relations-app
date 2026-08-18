import { createClient } from "@supabase/supabase-js";
import { findAgentByPromptId } from "./agentCatalog.js";

// Service-Role-Client, server-seitig — umgeht RLS bewusst (wie das bestehende Qdrant-Store-
// Muster in pipeline.js). Optional: Supabase ist additiv, die App läuft auch ohne konfiguriertes
// Projekt weiter (Case-Historie ist dann nur nicht verfügbar, /api/chat funktioniert unverändert).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

if (!supabaseAdmin) {
  console.warn(
    "WARNUNG: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nicht gesetzt — Fallhistorie (Verlauf/Fälle, " +
      "Risiko-Radar, Agenten-Kennzahlen) bleibt leer. /api/chat funktioniert trotzdem normal weiter."
  );
}

// Schreibt einen Case-Datensatz nach erfolgreicher Chat-Antwort. Darf die Antwort an den Nutzer
// nicht blockieren — Fehler werden nur geloggt, analog zu qdrantStore() in pipeline.js.
// Klärungsantworten (result.isClarification) werden nicht als Case gespeichert, da noch kein
// Prompt ausgeführt wurde.
export async function storeCase({ userId, sessionId, userQuestion, result }) {
  if (!supabaseAdmin || !userId || !result || result.isClarification) return;
  try {
    const agent = findAgentByPromptId(result.promptId);
    // Supabase-JS wirft bei einem fehlgeschlagenen Insert KEINE Exception, sondern liefert
    // { error } zurück — ohne diese Prüfung blieb ein Schreibfehler (z.B. user_id ist keine
    // gültige UUID/kein bekannter auth.users-Eintrag) bisher komplett unbemerkt: kein Log,
    // keine Fehlermeldung, der Fall fehlte einfach kommentarlos in Verlauf/Fälle.
    const { error } = await supabaseAdmin.from("cases").insert({
      user_id: userId,
      session_id: sessionId,
      prompt_id: result.promptId,
      prompt_name: result.promptUsed,
      agent_id: agent ? agent.id : null,
      title: result.promptUsed || null,
      question: userQuestion || "",
      answer: result.output || "",
      answer_html: result.html || null,
      escalation_suggested: !!(result.escalation && result.escalation.suggested),
      escalation_target: (result.escalation && result.escalation.target) || null,
    });
    if (error) {
      console.error("Fehler beim Schreiben des Case-Datensatzes nach Supabase:", error.message);
    }
  } catch (err) {
    console.error("Fehler beim Schreiben des Case-Datensatzes nach Supabase:", err);
  }
}
