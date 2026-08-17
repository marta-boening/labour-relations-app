import * as React from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const { user, userId, configured } = useAuth();
  const [displayName, setDisplayName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  async function save() {
    if (!supabase || !user) return;
    setSaving(true);
    await supabase.from("profiles").upsert({ id: user.id, display_name: displayName });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-surface px-6">
        <div className="text-sm font-semibold text-ink">Einstellungen</div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>
                {configured
                  ? "Angaben zu Ihrem Supabase-Konto."
                  : "Kein Supabase-Projekt konfiguriert — App läuft im lokalen Einzelnutzer-Modus."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  E-Mail
                </label>
                <Input value={user?.email ?? userId} disabled />
              </div>
              {configured && user && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-muted">
                    Anzeigename
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Anzeigename"
                    />
                    <Button variant="outline" onClick={save} disabled={saving}>
                      {saved ? "Gespeichert" : saving ? "…" : "Speichern"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System</CardTitle>
              <CardDescription>Verbindungsstatus der Datenquellen.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs text-ink-muted">
              <div className="flex items-center justify-between">
                <span>Backend / Router-Pipeline</span>
                <span className="text-risk-low">verbunden</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Supabase (Fälle, Login)</span>
                <span className={configured ? "text-risk-low" : "text-ink-subtle"}>
                  {configured ? "konfiguriert" : "nicht konfiguriert"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
