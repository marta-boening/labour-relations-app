---
name: confluence-platform
description: Erzeugt fertige Confluence-Seiten (Storage-Format + Copy-Paste-Anleitung) für digitale Zusammenarbeitsplattformen im Unternehmens-Space, im Stil des bestehenden "HR Board". Nutzen, wenn der Nutzer eine neue Confluence-Seite/Plattform/Board für ein Projekt oder Team aufbauen will und dafür nicht wieder wochenlang Makros und HTML von Hand zusammensetzen möchte. Kein direkter Zugriff auf Confluence selbst — Ergebnis ist eine Datei zum Einfügen bzw. ein Skript, das der Nutzer mit eigenen Zugangsdaten ausführt.
---

# Confluence Plattform-Generator

Baut aus einem kurzen Interview eine vollständige Confluence-Seite (Storage-Format-XHTML mit
Makros) für eine "digitale Zusammenarbeitsplattform" — Team-/Projekt-Startseiten wie das
bestehende **HR Board**. Ziel: Aus Wochen Handarbeit werden Minuten, indem eine kuratierte
Makro-Bibliothek und ein Standard-Blueprint wiederverwendet werden, statt bei null anzufangen.

Diese Session hat **keinen Zugriff auf die Confluence-Instanz** (kein API-Call durch Claude
selbst). Das Ergebnis ist immer eine lokale Datei, die der Nutzer entweder von Hand einfügt
oder mit dem mitgelieferten Skript (`scripts/publish-to-confluence.mjs`) unter Verwendung
seiner eigenen Zugangsdaten selbst hochlädt.

**Bekannter Kontext (bestätigt, nicht erneut erfragen):** Die Confluence-Instanz ist
**Server/Data Center**, läuft auf eigener Firmen-Domain (kein `*.atlassian.net`). Das
bedeutet: "Markup einfügen" → "Confluence Storage Format" ist im Editor verfügbar — der
Storage-Format-Weg (Schritt 3) ist damit der **Standardweg**, nicht nur eine von zwei
Optionen. Für die REST-API-Authentifizierung im Publish-Skript heißt das
`CONFLUENCE_AUTH_MODE=token` mit einem Personal Access Token (kein Atlassian-Account-
E-Mail/API-Token-Paar wie bei Cloud). Die Cloud-Anleitung bleibt als Referenz erhalten,
falls sich die Instanz irgendwann ändert oder eine zweite, Cloud-basierte Plattform
hinzukommt — muss aber nicht mehr aktiv abgefragt werden.

## Ablauf

### Schritt 0 — Bibliothek prüfen (erledigt, hier nur bei echten Neuerungen ergänzen)

Ein echter Storage-Format-Export des HR-Betriebsratsboards wurde bereits ausgewertet. Die
Kernerkenntnis: Das HR Board ist **kein** reiner Satz aus Standard-Confluence-Makros, sondern
ein zweiteiliges Muster — siehe `references/dynamic-dashboard-pattern.md`:

1. Eine separate **Datenpflege-Seite** mit **ConfiForm**-Formularen (Pflege der Inhalte über
   normale Formularfelder, kein HTML nötig).
2. Die **Anzeige-Seite** selbst, aufgebaut aus dem **HTML-Makro** (eigenes CSS/HTML) plus
   **`confiform-plain`**-Blöcken, die live gefilterte/sortierte Daten aus der Datenpflege-Seite
   ziehen und in ein Template einsetzen.

Das generalisierte CSS-Design-System aus dem echten Export liegt fertig zum Wiederverwenden in
`references/dashboard-design-system.css` (mit `{{PREFIX}}`/`{{FONT_STACK}}`-Platzhaltern).
Interne Identifikatoren (Domain, Seiten-IDs, Konto-Pfad) wurden beim Extrahieren entfernt —
die Rohdaten des Exports selbst wurden **nicht** ins Repo übernommen (nur die daraus
abgeleiteten, generischen Bausteine), um keine internen Firmen-Identifikatoren in der
Git-Historie zu speichern.

**Falls sich das HR Board später ändert oder ein zweites Referenz-Board exportiert wird:**
Storage-Format wie oben beschrieben per `{{CONFLUENCE_BASE_URL}}/rest/api/content/<pageId>?expand=body.storage`
holen (Server/Data Center — Base-URL ist die interne Firmen-Domain), im Gespräch einfügen
lassen, neue Muster wieder generalisiert (ohne interne IDs/Domain/E-Mail) in
`references/macro-library.md` bzw. `references/dynamic-dashboard-pattern.md` ergänzen.

### Schritt 1 — Kurzes Interview

Frag kompakt (nicht als Formular mit 15 Punkten, sondern 2-3 gebündelte Fragen) nach:

1. **Name & Zweck** der neuen Plattform, Zielgruppe (wer nutzt die Seite, wofür).
2. **Statisch oder datengetrieben?** (siehe `references/dynamic-dashboard-pattern.md`,
   Abschnitt „Wann dieses Muster wählen, wann nicht"):
   - **Datengetrieben** (wie das HR Board), wenn mehrere Personen die Inhalte laufend pflegen,
     Live-Kennzahlen/Zähler gewünscht sind, oder gefiltert/sortiert werden soll. Braucht eine
     eigene Datenpflege-Seite mit ConfiForm-Formularen (je Dateneinheit eines) — im Gespräch
     klären, welche Formulare/Felder nötig sind, und die Anlage dieser Formulare als
     eigenständigen Schritt für den Nutzer benennen (das kann diese Session nicht automatisch
     erledigen, da kein Confluence-Zugriff besteht).
   - **Statisch**, wenn die Seite selten aktualisiert wird oder kein Formular-Aufwand lohnt —
     dann reicht `references/blueprint-storage.xml` mit normalen Confluence-Makros.
3. **Welche Bausteine** gewünscht sind — biete die Standard-Bausteine aus
   `references/macro-library.md` als Liste an (Status-Dashboard, Team & Kontakte,
   Schnellzugriffe/Links, Fahrplan/Meilensteine, Entscheidungsprotokoll, Meeting-Notizen,
   FAQ, Onboarding/Erste Schritte, Eskalationspfad, Aufgabenliste, Kennzahlen, Ressourcen).
   Der Nutzer muss nicht alle wählen — nur was für dieses Projekt Sinn ergibt.
4. Konkrete Inhalte, wo nötig (Teammitglieder, erste Meilensteine, Ansprechpartner) — wenn
   der Nutzer das noch nicht parat hat, Platzhalter im Format `TODO: ...` einsetzen statt zu
   blockieren.

### Schritt 2 — Seite zusammenbauen

- Bei **datengetrieben**: `references/dashboard-design-system.css` (Prefix/Font ersetzen) plus
  `confiform-plain`-Blöcke aus `references/macro-library.md`/`dynamic-dashboard-pattern.md`
  kombinieren. Zusätzlich kurz auflisten, welche ConfiForm-Formulare (mit Feldern) der Nutzer
  auf der Datenpflege-Seite selbst anlegen muss — das ersetzt Schritt 2 nicht, ergänzt es aber.
- Bei **statisch**: `references/blueprint-storage.xml` als Grundgerüst nehmen.
- Entferne Blöcke, die der Nutzer nicht wollte; ergänze zusätzliche aus
  `references/macro-library.md`, falls gewünscht.
- Fülle Platzhalter (`{{PLATFORM_NAME}}`, `{{PURPOSE}}`, `{{OWNER}}`, Tabellenzeilen etc.)
  mit den Interview-Antworten.
- Halte die Struktur konsistent zum HR Board (Page-Properties-Kopf mit Status/Owner,
  zweispaltiges Layout oben, volle Breite für Tabellen/Roadmap darunter) — das schafft
  Wiedererkennbarkeit über alle Plattform-Seiten im Space hinweg.
- Schreibe das Ergebnis nach `output/<slug>-platform.storage.xml` (Slug aus dem
  Plattformnamen ableiten, Verzeichnis bei Bedarf anlegen).

### Schritt 3 — Einfüge-Anleitung mitliefern

Erzeuge zusätzlich `output/<slug>-einfuegen.md` mit passender Anleitung:

- **Standardweg (Server/Data Center):** Seite anlegen → "..." → "Markup einfügen" →
  "Confluence Storage Format" → Inhalt der `.storage.xml` einfügen → Vorschau prüfen →
  Einfügen. Das funktioniert in einem Rutsch, da Server/Data Center rohes Storage-Format
  akzeptiert.
- **Schnellster Weg:** `scripts/publish-to-confluence.mjs` mit `CONFLUENCE_AUTH_MODE=token`
  und einem Personal Access Token verwenden — legt die Seite per REST-API direkt an, ganz
  ohne manuelles Einfügen im Editor. Läuft mit den **Zugangsdaten des Nutzers**, nie mit
  Zugriff dieser Session. Siehe Kommentar am Kopf des Skripts für Aufruf/Env-Variablen.
- **Nur falls relevant (Cloud):** `references/cloud-paste-guide.md` ist als Referenz
  vorhanden, falls irgendwann eine zweite, Cloud-basierte Plattform dazukommt — für die
  aktuelle Server/Data-Center-Instanz nicht nötig.

### Schritt 4 — Bibliothek weiterpflegen

Wenn im Gespräch ein neuer, nützlicher Baustein entsteht (z. B. eine Tabellenvariante, ein
neues Makro-Muster), ergänze ihn in `references/macro-library.md` statt ihn nur einmalig in
der Ausgabedatei zu verwenden. So wird jede weitere Plattform-Seite schneller als die letzte —
das ist der eigentliche Zweck dieses Skills.

## Dateien in diesem Skill

- `references/macro-library.md` — kuratierte, copy-paste-fertige Confluence-Storage-Format-
  Bausteine (Panel, Info/Note/Warning/Tip, Status, Expand, TOC, Page Properties, Layout,
  Aufgabenliste, Jira-Makro, Children Display, Content by Label, Excerpt, HTML-Makro,
  ConfiForm Live-Liste).
- `references/blueprint-storage.xml` — vollständiges statisches Seitengerüst im HR-Board-Stil,
  mit `{{PLATZHALTERN}}`, das Schritt 2 für einfache Plattformen als Ausgangspunkt nimmt.
- `references/dynamic-dashboard-pattern.md` — das eigentliche, aus dem echten HR-Board-Export
  gewonnene Architekturmuster für datengetriebene Plattformen: Datenpflege-Seite (ConfiForm)
  + Anzeige-Seite (HTML-Makro + `confiform-plain`), inkl. Filter-/Sort-/queryCount-Syntax und
  wiederverwendbaren UI-Bausteinen (Hero, Kennzahlen-Karten, CSS-Akkordeon, Org-Kreisdiagramm,
  Prozess-Kette u. a.).
- `references/dashboard-design-system.css` — vollständiges, generalisiertes CSS für die
  datengetriebene Variante (`{{PREFIX}}`/`{{FONT_STACK}}`-Platzhalter), direkt aus dem echten
  HR-Board-Export abgeleitet.
- `references/cloud-paste-guide.md` — Zuordnung Baustein → Cloud-Slash-Command für den
  manuellen Nachbau, falls die Instanz irgendwann doch Cloud-basiert sein sollte.
- `scripts/publish-to-confluence.mjs` — Node-Skript, das eine `.storage.xml`-Datei per REST-
  API als neue (oder aktualisierte) Confluence-Seite anlegt. Braucht Zugangsdaten des
  Nutzers als Umgebungsvariablen, niemals von dieser Session ausgeführt.

**Hinweis:** Der rohe Storage-Format-Export des HR Boards selbst (mit internen Seiten-IDs,
Firmen-Domain, Konto-Pfad) wird bewusst **nicht** in diesem Repo gespeichert — nur die daraus
abgeleiteten, generalisierten Bausteine oben. Bei Bedarf kann der Export erneut im Gespräch
eingefügt werden (siehe Schritt 0); er muss dafür nicht dauerhaft irgendwo liegen.
