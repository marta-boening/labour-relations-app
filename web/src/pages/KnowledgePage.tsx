import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Link2,
  Newspaper,
  FileText,
  StickyNote,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { fetchAgents } from "@/lib/api";
import { fetchKnowledgeItems, addKnowledgeItem, deleteKnowledgeItem, type KnowledgeItemType } from "@/lib/knowledge";
import { useAuth } from "@/lib/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";

const TYPE_META: Record<KnowledgeItemType, { label: string; icon: typeof Link2 }> = {
  link: { label: "Link", icon: Link2 },
  article: { label: "Artikel", icon: Newspaper },
  document: { label: "Dokument", icon: FileText },
  note: { label: "Notiz", icon: StickyNote },
};

export function KnowledgePage() {
  const navigate = useNavigate();
  const { configured, userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const agents = agentsData?.agents ?? [];
  const byCategory = agents.reduce<Record<string, typeof agents>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const { data: items, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: fetchKnowledgeItems,
  });

  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [itemType, setItemType] = React.useState<KnowledgeItemType>("link");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await addKnowledgeItem({
      userId,
      title: title.trim(),
      url: url.trim(),
      itemType,
      notes: notes.trim(),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setUrl("");
    setNotes("");
    setItemType("link");
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
  }

  async function handleDelete(id: string) {
    await deleteKnowledgeItem(id);
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Wissen</div>
          <div className="text-[11px] text-ink-subtle">
            Eigene Wissensquellen sammeln, Fachgebiete durchsuchen
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="ablage" className="flex flex-col gap-5">
          <TabsList className="w-fit">
            <TabsTrigger value="ablage">Meine Ablage</TabsTrigger>
            <TabsTrigger value="fachgebiete">Fachgebiete</TabsTrigger>
          </TabsList>

          <TabsContent value="ablage" className="flex flex-col gap-5">
            {!configured && (
              <div className="rounded-xl border border-border bg-surface-alt p-4 text-xs text-ink-muted">
                Supabase ist noch nicht konfiguriert — die Ablage kann erst genutzt werden, sobald
                ein Supabase-Projekt verbunden ist.
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Neue Wissensquelle hinzufügen</CardTitle>
                <CardDescription>
                  Artikel, Urteile, interne Dokumente oder eigene Notizen ablegen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdd} className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TYPE_META) as KnowledgeItemType[]).map((t) => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setItemType(t)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            itemType === t
                              ? "border-ink bg-ink text-white"
                              : "border-border bg-surface text-ink-muted hover:border-border-hover"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    placeholder="Titel *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                  {itemType !== "note" && (
                    <Input
                      type="url"
                      placeholder="URL (optional)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  )}
                  <textarea
                    placeholder="Notizen (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl border border-border bg-sand px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-border-hover focus:ring-2 focus:ring-petrol-600/20"
                  />
                  {error && <p className="text-xs text-risk-high">{error}</p>}
                  <Button type="submit" variant="primary" size="sm" className="w-fit" disabled={saving || !configured}>
                    <Plus className="h-3.5 w-3.5" />
                    {saving ? "Speichert…" : "Hinzufügen"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              {isLoading && <div className="text-sm text-ink-subtle">Lädt…</div>}
              {!isLoading && configured && (items?.length ?? 0) === 0 && (
                <div className="text-sm text-ink-subtle">
                  Noch keine Wissensquellen abgelegt — füg oben die erste hinzu.
                </div>
              )}
              {items?.map((item) => {
                const meta = TYPE_META[item.item_type];
                const Icon = meta.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-petrol-800/10 text-petrol-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-sm font-medium text-ink hover:text-petrol-800 hover:underline"
                          >
                            {item.title}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-ink">{item.title}</span>
                        )}
                        <Badge variant="outline">{meta.label}</Badge>
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-ink-muted">{item.notes}</p>
                      )}
                      <span className="mt-1 block text-[11px] text-ink-subtle">
                        {new Date(item.created_at).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 text-ink-subtle hover:text-risk-high"
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="fachgebiete" className="flex flex-col gap-6">
            {Object.entries(byCategory).map(([category, catAgents]) => {
              const c = categoryColor(category);
              return (
                <div key={category}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-white", c.bg)}>
                      <GraduationCap className="h-3.5 w-3.5" />
                    </span>
                    {category}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catAgents.map((a) => (
                      <Card key={a.id} className={cn("border-t-2", c.border)}>
                        <CardHeader>
                          <CardTitle>{a.name}</CardTitle>
                          <CardDescription>{a.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="flex flex-col gap-1">
                            {a.prompts.map((p) => (
                              <li key={p.id}>
                                <button
                                  onClick={() => navigate("/chat", { state: { prefill: p.hint } })}
                                  className="text-left text-xs text-ink-muted hover:text-petrol-800 hover:underline"
                                >
                                  {p.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
