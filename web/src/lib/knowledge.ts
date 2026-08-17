import { supabase } from "@/lib/supabaseClient";

export type KnowledgeItemType = "link" | "article" | "document" | "note";

export interface KnowledgeItem {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  item_type: KnowledgeItemType;
  notes: string | null;
  created_at: string;
}

export async function fetchKnowledgeItems(): Promise<KnowledgeItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Fehler beim Laden der Wissensquellen:", error.message);
    return [];
  }
  return data as KnowledgeItem[];
}

export async function addKnowledgeItem(input: {
  userId: string;
  title: string;
  url?: string;
  itemType: KnowledgeItemType;
  notes?: string;
}): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
  const { error } = await supabase.from("knowledge_items").insert({
    user_id: input.userId,
    title: input.title,
    url: input.url || null,
    item_type: input.itemType,
    notes: input.notes || null,
  });
  return { error: error?.message };
}

export async function deleteKnowledgeItem(id: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Supabase ist nicht konfiguriert." };
  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
  return { error: error?.message };
}
