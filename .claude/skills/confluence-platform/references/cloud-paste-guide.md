# Confluence Cloud: Bausteine manuell nachbauen

Confluence Cloud erlaubt im Standard-Editor **kein** direktes Einfügen von rohem
Storage-Format-XHTML (anders als Server/Data Center mit "Markup einfügen"). Die generierte
`.storage.xml` ist trotzdem nicht nutzlos: Sie enthält bereits alle fertig formulierten
Inhalte (Texte, Tabellenzeilen, FAQ-Antworten) — es fehlt nur die Makro-Hülle, die man in
Cloud per Slash-Command in wenigen Sekunden pro Block erzeugt.

**Am schnellsten geht es trotzdem ganz ohne Copy-Paste-Ritual über die REST-API** — siehe
`scripts/publish-to-confluence.mjs`. Diese Anleitung hier ist der Fallback, falls kein
API-Token verfügbar/gewünscht ist.

## Vorgehen pro Block

1. Cursor an die gewünschte Stelle setzen.
2. `/` tippen, dann den Suchbegriff aus der Tabelle unten eingeben.
3. Makro auswählen, Inhalt aus der `.storage.xml`-Datei hineinkopieren (nur der reine Text/
   die Tabellenzeilen, nicht die `<ac:...>`-Tags — die erzeugt der Editor selbst).

## Zuordnung Baustein → Slash-Command

| Baustein in der `.storage.xml`        | Slash-Command in Cloud                          |
|----------------------------------------|--------------------------------------------------|
| `toc` (Inhaltsverzeichnis)             | `/toc` oder `/inhaltsverzeichnis`                 |
| `panel`                                | `/panel`                                          |
| `info` / `note` / `warning` / `tip`    | `/info`, `/hinweis`, `/warnung`, `/tipp` (im Panel-Auswahlmenü als Typ wählbar) |
| `status` (Lozenge)                     | `/status`                                         |
| `expand`                               | `/expand` bzw. `/erweitern`                       |
| `ac:layout` (Spalten)                  | `/layout` → Spaltenanzahl wählen                  |
| `details` (Page Properties)            | `/page properties` bzw. `/seiteneigenschaften`    |
| `detailssummary` (Report)              | `/page properties report`                         |
| `ac:task-list` (Aufgaben)              | Native Checkbox-Liste: `[]` gefolgt von Leerzeichen, oder `/task`/`/aufgabe` |
| Tabellen                               | `/table` bzw. `/tabelle`, oder einfach eine Markdown-Tabelle eintippen |
| `children` (Unterseiten-Liste)         | `/child pages` bzw. `/unterseiten`                |
| `contentbylabel`                       | `/content by label`                               |
| `jira`                                 | `/jira` (Jira-Verknüpfung muss bestehen)          |
| `excerpt` / `excerpt-include`          | `/excerpt`, `/excerpt include`                    |
| `anchor`                               | `/anchor` bzw. `/anker`                           |

## Tipp

Wenn dieselbe Plattform-Struktur öfter gebraucht wird: Einmal in Cloud fertig aufgebaute
Seite als **Vorlage speichern** (Seite → "..." → "Als Vorlage speichern" bzw. Space-
Einstellungen → Vorlagen). Danach entfällt der Slash-Command-Nachbau für zukünftige
Plattform-Seiten komplett — nur noch Inhalte aus der generierten `.storage.xml` einsetzen.
