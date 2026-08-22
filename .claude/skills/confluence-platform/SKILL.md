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

### Schritt 0 — Bibliothek prüfen (einmalig, nicht bei jedem Lauf nerven)

Prüfe, ob `references/hr-board-export.xml` existiert.

- **Falls ja:** Das ist ein echter Storage-Format-Export der bestehenden HR-Board-Seite.
  Durchsuche ihn nach `<ac:structured-macro ac:name="...">`-Blöcken, die noch **nicht** in
  `references/macro-library.md` dokumentiert sind, und ergänze sie dort (mit Kommentar
  „aus HR Board übernommen"). Das macht die Bibliothek über die Zeit präziser, weil sie
  dann echte, in dieser Instanz erprobte Makro-Syntax statt generischer Beispiele enthält.
- **Falls nein:** Erwähne einmal kurz (nicht wiederholt in jedem Lauf), dass ein Export der
  HR-Board-Seite die Genauigkeit deutlich verbessern würde, und wie man ihn bekommt:
  1. HR-Board-Seite öffnen, die `pageId` aus der URL notieren (Parameter `pageId=...`,
     oder über "..." → Seiteninformation).
  2. Im Browser (eingeloggt) aufrufen:
     - Cloud: `https://<space>.atlassian.net/wiki/rest/api/content/<pageId>?expand=body.storage`
     - Server/Data Center: `https://<host>/rest/api/content/<pageId>?expand=body.storage`
  3. Den Wert von `body.storage.value` (das ist escaptes XHTML) in
     `references/hr-board-export.xml` speichern (Escaping rückgängig machen, also
     `&lt;` → `<` etc.).
  Danach **ohne diesen Export fortfahren** — er ist eine Verbesserung, kein Blocker.

### Schritt 1 — Kurzes Interview

Frag kompakt (nicht als Formular mit 15 Punkten, sondern 2-3 gebündelte Fragen) nach:

1. **Name & Zweck** der neuen Plattform, Zielgruppe (wer nutzt die Seite, wofür).
2. **Welche Bausteine** gewünscht sind — biete die Standard-Bausteine aus
   `references/macro-library.md` als Liste an (Status-Dashboard, Team & Kontakte,
   Schnellzugriffe/Links, Fahrplan/Meilensteine, Entscheidungsprotokoll, Meeting-Notizen,
   FAQ, Onboarding/Erste Schritte, Eskalationspfad, Aufgabenliste, Kennzahlen, Ressourcen).
   Der Nutzer muss nicht alle wählen — nur was für dieses Projekt Sinn ergibt.
3. Konkrete Inhalte, wo nötig (Teammitglieder, erste Meilensteine, Ansprechpartner) — wenn
   der Nutzer das noch nicht parat hat, Platzhalter im Format `TODO: ...` einsetzen statt zu
   blockieren.

### Schritt 2 — Seite zusammenbauen

- Nimm `references/blueprint-storage.xml` als Grundgerüst.
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
  Aufgabenliste, Jira-Makro, Children Display, Content by Label, Excerpt).
- `references/blueprint-storage.xml` — vollständiges Seitengerüst im HR-Board-Stil, mit
  `{{PLATZHALTERN}}`, das Schritt 2 als Ausgangspunkt nimmt.
- `references/cloud-paste-guide.md` — Zuordnung Baustein → Cloud-Slash-Command für den
  manuellen Nachbau, wenn kein API-Zugang genutzt wird.
- `references/hr-board-export.xml` — **optional**, vom Nutzer bereitgestellter echter Export
  der HR-Board-Seite (siehe Schritt 0). Existiert anfangs nicht.
- `scripts/publish-to-confluence.mjs` — Node-Skript, das eine `.storage.xml`-Datei per REST-
  API als neue (oder aktualisierte) Confluence-Seite anlegt. Braucht Zugangsdaten des
  Nutzers als Umgebungsvariablen, niemals von dieser Session ausgeführt.
