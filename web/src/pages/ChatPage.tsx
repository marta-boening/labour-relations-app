import * as React from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Send, Search, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";
import { sendChatMessage, type ChatResponse } from "@/lib/api";

// Web Speech API — im TS-DOM-Lib nicht standardisiert, daher lose typisiert. Chrome/Edge/Safari
// unterstützen sie (unter dem webkit-Präfix), Firefox nicht — Mic-Button wird dann deaktiviert.
const SpeechRecognitionCtor: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  html?: string;
  isError?: boolean;
  streaming?: boolean;
  toolStatus?: string;
  timestamp: string;
  suggestedNextPrompts?: { id: string; label: string }[];
  escalation?: { suggested: boolean; target: string | null; reason: string | null };
}

function now() {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function makeSessionId() {
  return "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

interface PinnedPrompt {
  id: string;
  name: string;
}

export function ChatPage() {
  const { userId } = useAuth();
  const location = useLocation();
  const [sessionId, setSessionId] = React.useState(makeSessionId);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [pinnedPrompt, setPinnedPrompt] = React.useState<PinnedPrompt | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const recognitionRef = React.useRef<any>(null);
  const dictationBaseRef = React.useRef("");

  // Diktieren per Mikrofon (Web Speech API) — 1:1 aus dem alten chat.html übernommen, das
  // beim Umbau auf React versehentlich nicht mit portiert wurde.
  React.useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      if (finalTranscript) {
        dictationBaseRef.current =
          (dictationBaseRef.current ? dictationBaseRef.current + " " : "") + finalTranscript.trim();
      }
      setInput((dictationBaseRef.current + " " + interimTranscript).trim());
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e: any) => {
      setIsRecording(false);
      const messages: Record<string, string> = {
        "not-allowed": "Mikrofon-Zugriff wurde verweigert. Bitte in den Browser-Einstellungen erlauben.",
        "no-speech": "Keine Sprache erkannt.",
        "audio-capture": "Kein Mikrofon gefunden.",
      };
      setMicError(messages[e.error] || `Diktieren fehlgeschlagen: ${e.error}`);
      setTimeout(() => setMicError(null), 4000);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // bereits gestoppt — kein Problem
      }
    };
  }, []);

  function toggleRecording() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
      return;
    }
    dictationBaseRef.current = input.trim();
    setMicError(null);
    setIsRecording(true);
    try {
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  }

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Von der Prompts-/Agenten-Seite mit vorbelegtem Kontext + gewähltem Prompt angesprungen
  // (navigate("/chat", { state: { prefill, promptId, promptName } })), oder von Verlauf/Fälle
  // mit einem alten Fall zum Fortsetzen (state: { promptId, promptName, resumeCase }).
  // Ist promptId gesetzt, bleibt die gesamte Session direkt an diesen Prompt gebunden — kein
  // Router-Aufruf, keine Klärungsschleife (siehe pinnedPrompts in pipeline.js).
  React.useEffect(() => {
    const state = location.state as
      | {
          prefill?: string;
          promptId?: string;
          promptName?: string;
          resumeCase?: { question: string; answerHtml: string };
        }
      | null;
    if (state?.prefill) {
      setInput(state.prefill);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    if (state?.promptId) {
      setPinnedPrompt({ id: state.promptId, name: state.promptName ?? state.promptId });
    }
    if (state?.resumeCase) {
      // Nur clientseitig sichtbar gemacht — die Antwort kommt aus der gespeicherten
      // Fallhistorie, nicht neu vom Server. Der Sachverhalt wird der KI dennoch verfügbar,
      // sobald eine neue Frage gestellt wird: dieselbe Session ist an den Prompt gepinnt und
      // Qdrant liefert den alten Fall automatisch als RAG-Kontext zurück (gleicher Nutzer,
      // inhaltlich ähnlich).
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "user",
          text: state.resumeCase.question,
          timestamp: "früher",
        },
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: state.resumeCase.answerHtml,
          html: state.resumeCase.answerHtml,
          timestamp: "früher",
        },
      ]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNewOpenChat() {
    setSessionId(makeSessionId());
    setMessages([]);
    setPinnedPrompt(null);
    setInput("");
  }

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const botId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed, timestamp: now() },
      { id: botId, role: "bot", text: "", streaming: true, timestamp: now() },
    ]);
    setLoading(true);

    try {
      const data: ChatResponse = await sendChatMessage(
        { message: trimmed, sessionId, userId, promptId: pinnedPrompt?.id },
        (event) => {
          if (event.type === "delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId ? { ...m, text: m.text + event.text, toolStatus: undefined } : m
              )
            );
          } else if (event.type === "reset") {
            updateMessage(botId, { text: "", toolStatus: undefined });
          } else if (event.type === "tool") {
            updateMessage(botId, { toolStatus: event.query });
          }
        }
      );
      if (pinnedPrompt && data.promptUsed && data.promptUsed !== pinnedPrompt.name) {
        setPinnedPrompt({ id: pinnedPrompt.id, name: data.promptUsed });
      }
      updateMessage(botId, {
        text: data.output ?? "(leere Antwort)",
        html: data.answerHtml ?? data.html,
        streaming: false,
        toolStatus: undefined,
        suggestedNextPrompts: data.suggestedNextPrompts,
        escalation: data.escalation,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const friendly = message.includes("Failed to fetch")
        ? "Verbindung zum Server fehlgeschlagen. Läuft der Server (npm start in server/)?"
        : `Fehler: ${message}`;
      updateMessage(botId, { text: friendly, isError: true, streaming: false, toolStatus: undefined });
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 220) + "px";
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div className="text-sm font-semibold text-ink">Neuer Fall / Chat</div>
        <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
          <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-risk-low" />
          Online
        </div>
      </header>
      <div className="flex items-center gap-2 border-b border-border bg-surface-alt px-6 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
          Sitzung
        </span>
        <span className="font-mono text-[11px] text-ink-muted">{sessionId}</span>
      </div>

      {pinnedPrompt && (
        <div className="flex items-center gap-2 border-b border-border bg-petrol-800/5 px-6 py-2 text-xs">
          <span className="text-ink-muted">
            Direkt an <strong className="font-semibold text-ink">{pinnedPrompt.name}</strong> —
            kein automatisches Routing, keine Rückfragen zur Themenwahl.
          </span>
          <button
            onClick={startNewOpenChat}
            className="ml-auto shrink-0 text-ink-subtle underline decoration-dotted hover:text-ink"
          >
            Neuen offenen Chat starten
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-7">
        {messages.length === 0 && (
          <div className="mx-auto mb-2 max-w-[460px] rounded-2xl border border-border bg-surface p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ink">
              <MessageSquare className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <h2 className="mb-1.5 text-lg font-semibold text-ink">Wie kann ich helfen?</h2>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Ihr Experte für Arbeitsrecht, Betriebsverfassung und Personalmanagement — stellen
              Sie Ihre Frage.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageRow key={m.id} message={m} onFollowUp={send} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-6 pb-4.5 pt-3.5">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            maxLength={2000}
            placeholder="Frage eingeben ..."
            className="max-h-[220px] min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-sand px-[18px] py-[11px] text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-border-hover focus:ring-2 focus:ring-petrol-600/15 disabled:opacity-60"
          />
          <button
            onClick={toggleRecording}
            disabled={!SpeechRecognitionCtor || loading}
            title={
              !SpeechRecognitionCtor
                ? "Diktieren wird von diesem Browser nicht unterstützt (z.B. Chrome, Edge oder Safari verwenden)"
                : isRecording
                  ? "Aufnahme beenden"
                  : "Diktieren"
            }
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition",
              isRecording
                ? "animate-pulse border-risk-high bg-risk-high text-white"
                : "border-border bg-surface text-ink-muted hover:border-border-hover hover:text-ink",
              (!SpeechRecognitionCtor || loading) && "cursor-not-allowed opacity-30"
            )}
          >
            <Mic className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            title="Senden"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-petrol-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="mt-1.5 text-right text-[11px] text-ink-subtle">
          {micError ?? (isRecording
            ? "🎙️ Aufnahme läuft … zum Beenden nochmal klicken"
            : <>Enter zum Senden &nbsp;·&nbsp; Shift+Enter = neue Zeile</>)}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onFollowUp,
}: {
  message: ChatMessage;
  onFollowUp: (text: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
          isUser ? "bg-border-hover text-ink" : "bg-ink text-white"
        )}
      >
        {isUser ? "Du" : "LR"}
      </div>
      <div className={cn("flex max-w-[94%] flex-col gap-0.5", isUser && "max-w-[68%] items-end")}>
        <div
          className={cn(
            "rounded-2xl px-[15px] py-[11px] text-sm leading-relaxed break-words",
            isUser
              ? "rounded-br-[10px] bg-ink text-white"
              : "rounded-bl-[10px] border border-border bg-surface text-ink shadow-sm",
            message.isError && "border-[#ffd5d5] bg-[#fff5f5] text-risk-high"
          )}
        >
          {message.streaming ? (
            message.toolStatus ? (
              <span className="flex items-center gap-1.5 text-ink-muted">
                <Search className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                Recherchiert: „{message.toolStatus}"…
              </span>
            ) : message.text ? (
              <span className="whitespace-pre-wrap">{message.text}</span>
            ) : (
              <TypingDots />
            )
          ) : message.html && !message.isError ? (
            <div className="prose-answer" dangerouslySetInnerHTML={{ __html: message.html }} />
          ) : (
            message.text
          )}
        </div>

        {!isUser && !message.isError && (
          <FollowUps message={message} onFollowUp={onFollowUp} />
        )}

        <span className="px-1 text-[10px] text-ink-subtle">{message.timestamp}</span>
      </div>
    </div>
  );
}

function FollowUps({
  message,
  onFollowUp,
}: {
  message: ChatMessage;
  onFollowUp: (text: string) => void;
}) {
  const hasEscalation = message.escalation?.suggested && message.escalation.target;
  const hasNextSteps = message.suggestedNextPrompts && message.suggestedNextPrompts.length > 0;
  if (!hasEscalation && !hasNextSteps) return null;

  return (
    <div className="mt-1 flex max-w-full flex-wrap gap-1.5">
      {hasEscalation && (
        <button
          onClick={() => onFollowUp(`Ja, vertiefen mit ${message.escalation!.target}`)}
          className="rounded-full border border-petrol-700 bg-petrol-800/5 px-3 py-1.5 text-xs font-medium text-petrol-800 hover:bg-petrol-800/10"
        >
          Vertiefen mit {message.escalation!.target}
        </button>
      )}
      {message.suggestedNextPrompts?.map((step, i) => (
        <button
          key={i}
          onClick={() => onFollowUp(step.label)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-muted hover:border-border-hover hover:text-ink"
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-[5px] py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}
