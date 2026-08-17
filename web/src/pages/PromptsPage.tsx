import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPrompts, fetchAgents } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoryColor, initials } from "@/lib/categoryColors";

export function PromptsPage() {
  const navigate = useNavigate();
  const { data: catalog, isLoading } = useQuery({ queryKey: ["prompts"], queryFn: fetchPrompts });
  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const [category, setCategory] = React.useState<string>("Alle");
  const [depthFilter, setDepthFilter] = React.useState<"alle" | "quick" | "full">("alle");

  const promptToAgent = React.useMemo(() => {
    const map = new Map<string, string>();
    agentsData?.agents.forEach((a) => a.prompts.forEach((p) => map.set(p.id, a.name)));
    return map;
  }, [agentsData]);

  const promptToCategory = React.useMemo(() => {
    const map = new Map<string, string>();
    agentsData?.agents.forEach((a) => a.prompts.forEach((p) => map.set(p.id, a.category)));
    return map;
  }, [agentsData]);

  const categories = React.useMemo(
    () => ["Alle", ...Array.from(new Set(agentsData?.agents.map((a) => a.category) ?? []))],
    [agentsData]
  );

  const filtered = React.useMemo(() => {
    if (!catalog) return [];
    return catalog.prompts.filter((p) => {
      if (depthFilter !== "alle" && p.depth !== depthFilter) return false;
      if (category !== "Alle") {
        const agent = agentsData?.agents.find((a) => a.prompts.some((ap) => ap.id === p.id));
        if (!agent || agent.category !== category) return false;
      }
      return true;
    });
  }, [catalog, depthFilter, category, agentsData]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Prompts / Bibliothek</div>
          <div className="text-[11px] text-ink-subtle">
            Spezialisierte Prompts für alle Labour-Relations-Themen
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-alt px-6 py-3">
        {categories.map((c) => {
          const active = category === c;
          const isAll = c === "Alle";
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                !active && "border-border bg-surface text-ink-muted hover:border-border-hover",
                active && isAll && "border-ink bg-ink text-white",
                active && !isAll && cn(categoryColor(c).bg, categoryColor(c).border, "text-white")
              )}
            >
              {c}
            </button>
          );
        })}
        <span className="mx-2 h-4 w-px bg-border" />
        {(["alle", "quick", "full"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDepthFilter(d)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
              depthFilter === d
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-ink-muted hover:border-border-hover"
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <div className="text-sm text-ink-subtle">Lädt Prompt-Katalog…</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const cat = promptToCategory.get(p.id) ?? "";
            const c = categoryColor(cat);
            return (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold text-white",
                        c.bg
                      )}
                    >
                      {initials(promptToAgent.get(p.id) ?? p.name)}
                    </div>
                    <CardTitle>{p.name}</CardTitle>
                  </div>
                  <Badge variant={p.depth === "quick" ? "outline" : "petrol"}>{p.depth}</Badge>
                </div>
                <CardDescription>{p.hint}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2">
                {promptToAgent.get(p.id) && (
                  <span className="text-[11px] text-ink-subtle">
                    Agent: {promptToAgent.get(p.id)}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() =>
                    navigate("/chat", { state: { prefill: p.hint, promptId: p.id } })
                  }
                >
                  Prompt starten
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
