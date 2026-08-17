import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { fetchCases } from "@/lib/cases";
import { useAuth } from "@/lib/useAuth";
import { Badge } from "@/components/ui/badge";

// Prompts, deren Ergebnis typischerweise eine Risikoeinschätzung enthält — für eine erste,
// aus echten Fällen abgeleitete Auswertung. Eine quantitative 0–10-Score-Engine über alle
// Fälle ist bewusst nicht Teil dieser Version (siehe Plan, Phase 4: braucht zunächst ein
// strukturiertes Risiko-Output-Format der Fachprompts).
const RISK_RELEVANT_PROMPTS = new Set([
  "risiko-radar",
  "agg-check",
  "agg-kompass",
  "kundigungs-prufer",
  "prozess-lotse",
  "entscheidungs-pilot",
]);

export function RiskRadarPage() {
  const { configured } = useAuth();
  const { data: cases, isLoading } = useQuery({ queryKey: ["cases"], queryFn: () => fetchCases() });

  const riskCases = React.useMemo(
    () => (cases ?? []).filter((c) => RISK_RELEVANT_PROMPTS.has(c.prompt_id)),
    [cases]
  );
  const escalations = riskCases.filter((c) => c.escalation_suggested);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Risiko-Radar</div>
          <div className="text-[11px] text-ink-subtle">
            Arbeitsrechtliche Risiken erkennen, bewerten und steuern
          </div>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-border bg-surface-alt px-6 py-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Risikorelevante Fälle
          </div>
          <div className="mt-1 text-xl font-semibold text-ink">{riskCases.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
            Mit Vertiefungsempfehlung
          </div>
          <div className="mt-1 text-xl font-semibold text-ink">{escalations.length}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!configured && (
          <div className="mb-4 rounded-xl border border-border bg-surface-alt p-4 text-xs text-ink-muted">
            Supabase ist noch nicht konfiguriert — es werden noch keine Fälle ausgewertet. Eine
            vollständige Risiko-Score-Engine (Gesamtrisiko, Risikoverteilung) ist als nächster
            Ausbauschritt vorgesehen, sobald die Fachprompts strukturierte Risikodaten liefern.
          </div>
        )}
        {configured && isLoading && <div className="text-sm text-ink-subtle">Lädt…</div>}
        {configured && !isLoading && riskCases.length === 0 && (
          <div className="text-sm text-ink-subtle">
            Noch keine risikorelevanten Fälle (Kündigung, AGG, Risiko-Radar, Prozess/Entscheidung).
          </div>
        )}

        <div className="flex flex-col gap-2">
          {riskCases.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-medium" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {c.prompt_name || c.prompt_id}
                  </span>
                  {c.escalation_suggested && <Badge variant="high">Vertiefung empfohlen</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{c.question}</p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-subtle">
                {new Date(c.created_at).toLocaleDateString("de-DE")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
