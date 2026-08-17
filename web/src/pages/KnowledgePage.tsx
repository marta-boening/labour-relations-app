import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { fetchAgents } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { categoryColor } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";

// v1: Wissen als Themenübersicht direkt aus dem bestehenden Prompt-/Agenten-Katalog abgeleitet
// (Kategorien aus agentCatalog.js) statt einer separaten Wissensdatenbank — eine eigenständige
// Wissensartikel-Verwaltung ist im Mockup nicht spezifiziert genug, um sie hier zu bauen.
export function KnowledgePage() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const agents = data?.agents ?? [];

  const byCategory = agents.reduce<Record<string, typeof agents>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Wissen</div>
          <div className="text-[11px] text-ink-subtle">
            Themenübersicht auf Basis der Fach-Agenten und Prompts
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
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
                              onClick={() =>
                                navigate("/chat", { state: { prefill: p.hint } })
                              }
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
        </div>
      </div>
    </div>
  );
}
