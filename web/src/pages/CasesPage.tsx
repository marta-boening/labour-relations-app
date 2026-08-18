import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronRight, MessageSquarePlus } from "lucide-react";
import { fetchCases, type CaseRow } from "@/lib/cases";
import { useAuth } from "@/lib/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CasesPage() {
  const navigate = useNavigate();
  const { configured } = useAuth();
  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => fetchCases(),
  });
  const [selected, setSelected] = React.useState<CaseRow | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-semibold text-ink">Verlauf / Fälle</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full max-w-md shrink-0 overflow-y-auto border-r border-border">
          {!configured && (
            <div className="m-4 rounded-xl border border-border bg-surface-alt p-4 text-xs text-ink-muted">
              Supabase ist noch nicht konfiguriert — die Fallhistorie ist erst nach Einrichtung
              von <code className="text-[11px]">VITE_SUPABASE_URL</code>/
              <code className="text-[11px]">VITE_SUPABASE_ANON_KEY</code> verfügbar.
            </div>
          )}
          {configured && isLoading && (
            <div className="p-6 text-sm text-ink-subtle">Lädt Fälle…</div>
          )}
          {configured && !isLoading && cases?.length === 0 && (
            <div className="p-6 text-sm text-ink-subtle">
              Noch keine Fälle. Starten Sie einen neuen Fall im Chat.
            </div>
          )}
          {cases?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`flex w-full items-start gap-2 border-b border-border px-5 py-4 text-left transition hover:bg-surface-alt ${
                selected?.id === c.id ? "bg-surface-alt" : ""
              }`}
            >
              <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {c.title || c.prompt_id}
                  </span>
                  {c.escalation_suggested && <Badge variant="medium">Vertiefung</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{c.question}</p>
                <span className="mt-1 block text-[11px] text-ink-subtle">
                  {formatDate(c.created_at)}
                </span>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-subtle" />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-subtle">
              Fall auswählen, um Details zu sehen.
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {selected.prompt_name || selected.prompt_id}
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    navigate("/chat", {
                      state: {
                        promptId: selected.prompt_id,
                        promptName: selected.prompt_name ?? selected.prompt_id,
                        resumeCase: {
                          question: selected.question,
                          answerHtml: selected.answer_html || selected.answer,
                        },
                      },
                    })
                  }
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Fall fortsetzen
                </Button>
              </div>
              <h1 className="mb-4 text-lg font-semibold text-ink">
                {selected.title || "Fall"}
              </h1>
              <div className="mb-6 rounded-2xl border border-border bg-surface p-4 text-sm text-ink-muted">
                {selected.question}
              </div>
              <div
                className="prose-answer text-sm text-ink"
                dangerouslySetInnerHTML={{
                  __html: selected.answer_html || selected.answer,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
