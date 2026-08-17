import * as React from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/useAuth";

export function LoginPage() {
  const { signInWithPassword, signUp } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [info, setInfo] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const result =
      mode === "signin" ? await signInWithPassword(email, password) : await signUp(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setInfo("Konto angelegt. Falls Bestätigungs-E-Mails aktiv sind, bitte Posteingang prüfen.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink">
            <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-base font-semibold text-ink">Labour Relations Experte</h1>
          <p className="mt-1 text-xs text-ink-muted">
            {mode === "signin" ? "Anmelden, um fortzufahren" : "Neues Konto anlegen"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            type="password"
            required
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
          />
          {error && <p className="text-xs text-risk-high">{error}</p>}
          {info && <p className="text-xs text-risk-low">{info}</p>}
          <Button type="submit" variant="primary" disabled={busy} className="mt-1">
            {busy ? "Einen Moment…" : mode === "signin" ? "Anmelden" : "Konto anlegen"}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-xs text-ink-subtle hover:text-ink"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Anmelden"}
        </button>
      </div>
    </div>
  );
}
