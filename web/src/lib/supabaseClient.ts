import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// anon/public Key — sicher fürs Frontend, RLS in supabase/migrations/0001_init.sql schützt
// die Leserichtung. Ohne konfiguriertes Projekt läuft die App im "nicht angemeldet"-Zustand
// weiter (Chat funktioniert über den Server unverändert, Fälle/Risiko-Radar bleiben leer).
export const supabase = supabaseConfigured ? createClient(url as string, anonKey as string) : null;
