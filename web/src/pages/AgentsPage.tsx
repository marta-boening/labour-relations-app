import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Sparkles, Scale, Clock, X, MessageSquare } from "lucide-react";
import { fetchAgents, type AgentSummary } from "@/lib/api";
import { fetchCases } from "@/lib/cases";
import { useAuth } from "@/lib/useAuth";
import { categoryColor, initials } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CATEGORY_FILL: Record<string, string> = {
  Strategie: "fill-cat-strategie",
  Compliance: "fill-cat-compliance",
  Betriebsrat: "fill-cat-betriebsrat",
  Verhandlung: "fill-cat-verhandlung",
  Arbeitsrecht: "fill-cat-arbeitsrecht",
  "HR-Management": "fill-cat-hr-management",
};

const SIZE = 620;
const CENTER = SIZE / 2;
const RADIUS = 240;
const NODE_R = 30;
const HUB_R = 46;

function nodePosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tg.`;
}

export function AgentsPage() {
  const navigate = useNavigate();
  const { configured } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: () => fetchCases(8) });
  const [selected, setSelected] = React.useState<AgentSummary | null>(null);
  const agents = data?.agents ?? [];

  const totalPrompts = agents.reduce((sum, a) => sum + a.promptCount, 0);
  const totalCases = agents.reduce((sum, a) => sum + a.caseCount, 0);
  const activeAgents = agents.filter((a) => a.caseCount > 0).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Agenten-Netzwerk</div>
          <div className="text-[11px] text-ink-subtle">
            Spezialisierte KI-Agenten für Labour Relations
          </div>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-border bg-surface-alt px-6 py-4 sm:grid-cols-4">
        <Stat label="Agenten" value={String(agents.length)} icon={Users} />
        <Stat label="Davon mit Fällen" value={`${activeAgents} / ${agents.length}`} icon={Sparkles} />
        <Stat label="Prompts insgesamt" value={String(totalPrompts)} icon={Sparkles} />
        <Stat label="Fälle insgesamt" value={String(totalCases)} icon={Clock} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {isLoading && <div className="text-sm text-ink-subtle">Lädt Agenten…</div>}
          {!isLoading && (
            <div className="mx-auto w-full max-w-[640px]">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full">
                {agents.map((agent, i) => {
                  const pos = nodePosition(i, agents.length);
                  return (
                    <line
                      key={`line-${agent.id}`}
                      x1={CENTER}
                      y1={CENTER}
                      x2={pos.x}
                      y2={pos.y}
                      className="stroke-border-hover"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  );
                })}

                <circle cx={CENTER} cy={CENTER} r={HUB_R} className="fill-petrol-900" />
                <foreignObject
                  x={CENTER - HUB_R}
                  y={CENTER - HUB_R}
                  width={HUB_R * 2}
                  height={HUB_R * 2}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center text-white">
                    <Scale className="h-5 w-5" strokeWidth={2} />
                  </div>
                </foreignObject>
                <text
                  x={CENTER}
                  y={CENTER + HUB_R + 16}
                  textAnchor="middle"
                  className="fill-ink text-[13px] font-semibold"
                >
                  Orchestrator
                </text>
                <text
                  x={CENTER}
                  y={CENTER + HUB_R + 30}
                  textAnchor="middle"
                  className="fill-ink-subtle text-[10px]"
                >
                  Router · RAG · Executor
                </text>

                {agents.map((agent, i) => {
                  const pos = nodePosition(i, agents.length);
                  const fill = CATEGORY_FILL[agent.category] ?? "fill-petrol-700";
                  const isSelected = selected?.id === agent.id;
                  return (
                    <g
                      key={agent.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(agent)}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? NODE_R + 4 : NODE_R}
                        className={cn(fill, "transition-all")}
                        stroke={isSelected ? "#1a1a18" : "transparent"}
                        strokeWidth={2}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 4}
                        textAnchor="middle"
                        className="fill-white text-[11px] font-semibold"
                      >
                        {initials(agent.name)}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + NODE_R + 16}
                        textAnchor="middle"
                        className="fill-ink text-[11px] font-medium"
                      >
                        {agent.name}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + NODE_R + 28}
                        textAnchor="middle"
                        className="fill-ink-subtle text-[9px]"
                      >
                        {agent.category}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {selected && (
                <AgentDetailCard
                  agent={selected}
                  onClose={() => setSelected(null)}
                  onStartChat={(prompt) =>
                    navigate("/chat", {
                      state: { prefill: prompt.hint, promptId: prompt.id, promptName: prompt.name },
                    })
                  }
                />
              )}
            </div>
          )}
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-surface-alt p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Aktuelle Aktivitäten
          </div>
          {!configured && (
            <p className="text-xs text-ink-subtle">
              Verfügbar, sobald Supabase konfiguriert ist.
            </p>
          )}
          {configured && (!cases || cases.length === 0) && (
            <p className="text-xs text-ink-subtle">Noch keine Fälle bearbeitet.</p>
          )}
          <div className="flex flex-col gap-3">
            {cases?.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="text-xs font-medium text-ink">{c.prompt_name || c.prompt_id}</div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-muted">{c.question}</p>
                <span className="mt-1 block text-[10px] text-ink-subtle">
                  {relativeTime(c.created_at)}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-ink-subtle">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function AgentDetailCard({
  agent,
  onClose,
  onStartChat,
}: {
  agent: AgentSummary;
  onClose: () => void;
  onStartChat: (prompt: { id: string; name: string; hint: string }) => void;
}) {
  // Bei genau einem Prompt ist die Wahl eindeutig — Direkt-Button. Bei mehreren würde ein
  // "primärer" Prompt geraten werden müssen (z.B. per Zufall/Reihenfolge in agentCatalog.js),
  // was nicht zuverlässig zum tatsächlichen Anliegen passt (siehe agentCatalog.js: die
  // Reihenfolge ist keine Relevanz-Sortierung). Deshalb bei mehreren Prompts direkt die
  // Auswahl zeigen, statt falsch zu raten.
  const c = categoryColor(agent.category);
  const singlePrompt = agent.prompts.length === 1 ? agent.prompts[0] : null;

  return (
    <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white",
              c.bg
            )}
          >
            {initials(agent.name)}
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">{agent.name}</div>
            <Badge className={cn("mt-0.5 border bg-surface", c.text, c.border)}>
              {agent.category}
            </Badge>
          </div>
        </div>
        <button onClick={onClose} className="text-ink-subtle hover:text-ink" title="Schließen">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm text-ink-muted">{agent.description}</p>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-subtle">
        <span>{agent.promptCount} Prompts</span>
        <span>·</span>
        <span>{agent.caseCount} bearbeitete Fälle</span>
      </div>

      {singlePrompt ? (
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => onStartChat(singlePrompt)}
        >
          <MessageSquare className="h-4 w-4" />
          Neuen Fall an {agent.name} übergeben
        </Button>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-ink-muted">
            Dieser Agent bündelt {agent.promptCount} Prompts — welcher passt am besten?
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {agent.prompts.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface-alt p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink">{p.name}</span>
                  <Badge variant="outline">{p.depth}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">{p.hint}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => onStartChat(p)}>
                  Mit diesem Prompt chatten
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
