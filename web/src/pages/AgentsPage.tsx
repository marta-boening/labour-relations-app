import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Sparkles } from "lucide-react";
import { fetchAgents } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AgentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const agents = data?.agents ?? [];

  const totalPrompts = agents.reduce((sum, a) => sum + a.promptCount, 0);
  const totalCases = agents.reduce((sum, a) => sum + a.caseCount, 0);

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

      <div className="grid shrink-0 grid-cols-3 gap-4 border-b border-border bg-surface-alt px-6 py-4 sm:grid-cols-3">
        <Stat label="Agenten" value={String(agents.length)} icon={Users} />
        <Stat label="Prompts insgesamt" value={String(totalPrompts)} icon={Sparkles} />
        <Stat label="Fälle insgesamt" value={String(totalCases)} icon={Users} />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <div className="text-sm text-ink-subtle">Lädt Agenten…</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{agent.name}</CardTitle>
                  <Badge variant="petrol">{agent.category}</Badge>
                </div>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {agent.prompts.map((p) => (
                    <Badge key={p.id} variant="outline">
                      {p.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-subtle">
                  <span>{agent.promptCount} Prompts</span>
                  <span>{agent.caseCount} Fälle bearbeitet</span>
                </div>
                <button
                  onClick={() =>
                    navigate("/chat", { state: { prefill: agent.prompts[0]?.hint ?? "" } })
                  }
                  className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium text-ink-muted transition hover:border-border-hover hover:text-ink"
                >
                  Fall an {agent.name} übergeben
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
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
