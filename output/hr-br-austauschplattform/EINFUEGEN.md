# HR-BR Austauschplattform — Einfügen in Confluence

Reihenfolge einhalten: Erst die Gremium-Seiten anlegen (mit exakt diesen Titeln, sonst
funktionieren die Links auf der Landing-Seite und die `confiform-plain`-Verweise auf der
HR-Übersicht nicht), zuletzt Landing-Seite und HR-Übersicht.

## 1. Manueller Weg (Server/Data Center)

Für jede Datei: Seite anlegen → "..." → "Markup einfügen" → "Confluence Storage Format" →
Inhalt einfügen → Vorschau prüfen → Einfügen. **Seitentitel exakt wie folgt setzen:**

| Datei | Seitentitel | Danach beschränken auf |
|---|---|---|
| `gbr-ag.storage.xml` | `GBR AG` | Gruppe `GBR-AG-Mitglieder` + HR-Gruppe |
| `gbr-service.storage.xml` | `GBR Service` | Gruppe `GBR-Service-Mitglieder` + HR-Gruppe |
| `kbr.storage.xml` | `KBR` | Gruppe `KBR-Mitglieder` + HR-Gruppe |
| `oertlicher-br-vorlage.storage.xml` | (Vorlage, Phase 2 — vorerst nicht anlegen) | — |
| `landing.storage.xml` | `HR-BR Austauschplattform` | keine (frei im Space sichtbar) |
| `hr-uebersicht.storage.xml` | `HR-Übersicht (BR-Austausch)` | nur HR-Gruppe |

Zugriffsbeschränkung setzen: Seite öffnen → "..." → "Beschränkungen" → Gruppen eintragen
(Lesen **und** Bearbeiten).

**Wichtig:** Die Gruppen `GBR-AG-Mitglieder`, `GBR-Service-Mitglieder`, `KBR-Mitglieder` und
eure HR-Gruppe müssen vorher existieren (Confluence-Administration). Falls noch nicht
vorhanden: vor dem Beschränken anlegen, sonst bleiben die Seiten vorerst unbeschränkt.

## 2. Schnellerer Weg — Publish-Skript (legt an UND beschränkt in einem Rutsch)

```bash
export CONFLUENCE_BASE_URL="https://<eure-domain>"
export CONFLUENCE_AUTH_MODE=token
export CONFLUENCE_API_TOKEN="<euer Personal Access Token>"
export CONFLUENCE_SPACE_KEY="<Space-Key>"

node .claude/skills/confluence-platform/scripts/publish-to-confluence.mjs \
  --file output/hr-br-austauschplattform/gbr-ag.storage.xml \
  --title "GBR AG" --restrict-groups "GBR-AG-Mitglieder,HR-Team"

node .claude/skills/confluence-platform/scripts/publish-to-confluence.mjs \
  --file output/hr-br-austauschplattform/gbr-service.storage.xml \
  --title "GBR Service" --restrict-groups "GBR-Service-Mitglieder,HR-Team"

node .claude/skills/confluence-platform/scripts/publish-to-confluence.mjs \
  --file output/hr-br-austauschplattform/kbr.storage.xml \
  --title "KBR" --restrict-groups "KBR-Mitglieder,HR-Team"

node .claude/skills/confluence-platform/scripts/publish-to-confluence.mjs \
  --file output/hr-br-austauschplattform/landing.storage.xml \
  --title "HR-BR Austauschplattform"

node .claude/skills/confluence-platform/scripts/publish-to-confluence.mjs \
  --file output/hr-br-austauschplattform/hr-uebersicht.storage.xml \
  --title "HR-Übersicht (BR-Austausch)" --restrict-groups "HR-Team"
```

Gruppennamen (`GBR-AG-Mitglieder`, `HR-Team`, …) an eure echten Confluence-Gruppennamen
anpassen — die hier verwendeten sind Platzhalter-Vorschläge.

## 3. Vor Freigabe unbedingt prüfen

1. Auf jeder Gremium-Seite: Beschränkung tatsächlich aktiv? (Mit einem Test-Account ohne
   Gruppenzugehörigkeit testen — die Seite darf für diesen Account nicht sichtbar sein.)
2. Auf der HR-Übersicht: Zeigt sie wirklich nur das, was ein HR-Team-Mitglied sehen soll?
   Siehe Warnhinweis in `hr-uebersicht.storage.xml` zur Cross-Page-Aggregation.
3. `ConfiForm`-App und `html`-Makro sind in dieser Instanz bereits aktiv (bekannt aus dem
   HR Board) — trotzdem einmal eine Test-Seite mit einem kleinen `confiform`-Block anlegen,
   bevor alle sechs Seiten produktiv gehen.

## 4. Phase 2 (örtliche BRs)

Pro Standort: `oertlicher-br-vorlage.storage.xml` kopieren, `{{STANDORT_NAME}}` und
`{{STANDORT_SLUG}}` ersetzen, Seitentitel z. B. `Örtlicher BR – Region Süd`, auf
Standort-Gruppe + HR beschränken, danach in `hr-uebersicht.storage.xml` einen weiteren
`confiform-plain`-Block für diesen Standort ergänzen (siehe Hinweis am Ende der Datei).
