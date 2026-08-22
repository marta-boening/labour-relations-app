# Confluence Makro-Bibliothek (Storage-Format)

Copy-paste-fertige Bausteine im Confluence **Storage Format** (XHTML mit `ac:`/`ri:`-
Namespace). Jeder Block ist eigenständig einfügbar. Platzhalter sind `{{SO_GESCHRIEBEN}}`.

> **Hinweis zur Genauigkeit:** Die Makro-Syntax hier folgt der offiziellen Confluence-
> Dokumentation und ist in der Praxis stabil, kann aber je nach Confluence-Version und
> installierten Marketplace-Apps in Details abweichen. Vor dem produktiven Einsatz einmal
> einen kleinen Block testweise einfügen und die Vorschau prüfen. Noch zuverlässiger: die
> eigene HR-Board-Seite exportieren (siehe `SKILL.md`, Schritt 0) und daraus erprobte Blöcke
> in diese Datei übernehmen — dann ist die Syntax garantiert kompatibel mit der eigenen
> Instanz.

---

## Inhaltsverzeichnis (TOC)

Gehört an den Seitenanfang jeder längeren Plattform-Seite.

```xml
<ac:structured-macro ac:name="toc" ac:schema-version="1">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>
```

---

## Panel (allgemeiner Rahmen mit Titel)

Für Intro-Text, Zweck-Beschreibung, hervorgehobene Bereiche.

```xml
<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="title">{{TITEL}}</ac:parameter>
  <ac:parameter ac:name="borderColor">#0052CC</ac:parameter>
  <ac:parameter ac:name="bgColor">#DEEBFF</ac:parameter>
  <ac:rich-text-body>
    <p>{{INHALT}}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

## Info / Note / Warning / Tip

Vier baugleiche Makros, nur `ac:name` ändert sich: `info`, `note`, `warning`, `tip`.

```xml
<ac:structured-macro ac:name="info" ac:schema-version="1">
  <ac:rich-text-body>
    <p>{{HINWEISTEXT}}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## Status-Lozenge (farbiges Status-Label)

Für "ON TRACK", "AT RISK", "DONE" etc. `ac:parameter ac:name="colour"` ist eines von:
`Grey`, `Red`, `Yellow`, `Green`, `Blue`, `Purple`.

```xml
<ac:structured-macro ac:name="status" ac:schema-version="1">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">{{STATUS_TEXT}}</ac:parameter>
  <ac:parameter ac:name="subtle">false</ac:parameter>
</ac:structured-macro>
```

---

## Expand (aufklappbarer Block)

Ideal für FAQ-Einträge — ein `expand` pro Frage.

```xml
<ac:structured-macro ac:name="expand" ac:schema-version="1">
  <ac:parameter ac:name="title">{{FRAGE}}</ac:parameter>
  <ac:rich-text-body>
    <p>{{ANTWORT}}</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## Layout (Spalten)

Kein Makro, sondern native Storage-Format-Tags. `ac:type` steuert die Spaltenaufteilung:
`two_equal`, `two_left_sidebar`, `two_right_sidebar`, `three_equal`, `single`.

```xml
<ac:layout>
  <ac:layout-section ac:type="two_equal">
    <ac:layout-cell>
      <p>{{LINKE_SPALTE}}</p>
    </ac:layout-cell>
    <ac:layout-cell>
      <p>{{RECHTE_SPALTE}}</p>
    </ac:layout-cell>
  </ac:layout-section>
</ac:layout>
```

---

## Page Properties (Kopf-Metadaten: Owner, Status, letztes Update)

Macht jede Plattform-Seite auf den ersten Blick einheitlich lesbar — genau der Baustein, der
den "wie beim HR Board"-Wiedererkennungswert bringt.

```xml
<ac:structured-macro ac:name="details" ac:schema-version="1">
  <ac:parameter ac:name="id">{{EINDEUTIGE_ID}}</ac:parameter>
  <ac:rich-text-body>
    <table>
      <tbody>
        <tr>
          <th>Owner</th>
          <td>{{OWNER}}</td>
        </tr>
        <tr>
          <th>Status</th>
          <td>
            <ac:structured-macro ac:name="status" ac:schema-version="1">
              <ac:parameter ac:name="colour">Green</ac:parameter>
              <ac:parameter ac:name="title">{{STATUS_TEXT}}</ac:parameter>
            </ac:structured-macro>
          </td>
        </tr>
        <tr>
          <th>Letztes Update</th>
          <td>{{DATUM}}</td>
        </tr>
        <tr>
          <th>Nächster Meilenstein</th>
          <td>{{MEILENSTEIN}}</td>
        </tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>
```

Zugehöriger Report (z. B. auf einer übergeordneten Übersichtsseite, listet alle Unterseiten
mit `details`-Makro auf):

```xml
<ac:structured-macro ac:name="detailssummary" ac:schema-version="1">
  <ac:parameter ac:name="cql">label = "{{LABEL}}" and space = currentSpace()</ac:parameter>
</ac:structured-macro>
```

---

## Aufgabenliste (native Task-List)

Checkbox-Liste mit Zuweisung — kein separates Makro, native Storage-Format-Tags.

```xml
<ac:task-list>
  <ac:task>
    <ac:task-id>1</ac:task-id>
    <ac:task-status>incomplete</ac:task-status>
    <ac:task-body>{{AUFGABE}}</ac:task-body>
  </ac:task>
  <ac:task>
    <ac:task-id>2</ac:task-id>
    <ac:task-status>incomplete</ac:task-status>
    <ac:task-body>{{WEITERE_AUFGABE}}</ac:task-body>
  </ac:task>
</ac:task-list>
```

---

## Tabelle (Team & Kontakte / Entscheidungsprotokoll / Eskalationspfad)

Standard-HTML-Tabelle, funktioniert direkt im Storage-Format. Spaltenüberschriften je nach
Zweck anpassen — z. B. für Team & Kontakte: Rolle / Name / Kontakt; für Entscheidungsprotokoll:
Datum / Entscheidung / Begründung / Entschieden von; für Eskalationspfad: Stufe / Ansprechpartner
/ Wann eskalieren.

```xml
<table>
  <tbody>
    <tr>
      <th>{{SPALTE_1}}</th>
      <th>{{SPALTE_2}}</th>
      <th>{{SPALTE_3}}</th>
    </tr>
    <tr>
      <td>{{WERT_1}}</td>
      <td>{{WERT_2}}</td>
      <td>{{WERT_3}}</td>
    </tr>
  </tbody>
</table>
```

---

## Children Display (automatische Liste der Unterseiten)

Für "Meeting-Notizen" oder "Ressourcen" als Verweis auf Unterseiten, ohne Liste manuell zu
pflegen.

```xml
<ac:structured-macro ac:name="children" ac:schema-version="1">
  <ac:parameter ac:name="depth">2</ac:parameter>
</ac:structured-macro>
```

## Content by Label (dynamische Liste per Label)

```xml
<ac:structured-macro ac:name="contentbylabel" ac:schema-version="1">
  <ac:parameter ac:name="cql">label = "{{LABEL}}" and space = currentSpace()</ac:parameter>
</ac:structured-macro>
```

---

## Jira-Issues-Makro (falls Jira verknüpft ist)

Für Kennzahlen/Fahrplan-Bereiche, die offene Tickets live anzeigen sollen.

```xml
<ac:structured-macro ac:name="jira" ac:schema-version="1">
  <ac:parameter ac:name="server">{{JIRA_SERVERNAME}}</ac:parameter>
  <ac:parameter ac:name="jqlQuery">{{JQL_QUERY}}</ac:parameter>
</ac:structured-macro>
```

---

## Excerpt / Excerpt Include (wiederverwendbare Textbausteine über mehrere Seiten)

Nützlich, wenn mehrere Plattform-Seiten denselben Baustein teilen sollen (z. B. eine
gemeinsame Kontakt-Box für alle Team-Boards), damit er nur an einer Stelle gepflegt wird.

```xml
<!-- Auf der Quellseite: -->
<ac:structured-macro ac:name="excerpt" ac:schema-version="1">
  <ac:parameter ac:name="atlassian-macro-output-type">BLOCK</ac:parameter>
  <ac:rich-text-body>
    <p>{{WIEDERVERWENDBARER_INHALT}}</p>
  </ac:rich-text-body>
</ac:structured-macro>

<!-- Auf jeder Zielseite: -->
<ac:structured-macro ac:name="excerpt-include" ac:schema-version="1">
  <ac:parameter ac:name="">{{TITEL_DER_QUELLSEITE}}</ac:parameter>
  <ac:parameter ac:name="nopanel">true</ac:parameter>
</ac:structured-macro>
```

---

## HTML-Makro (eigenes CSS/HTML/JS einbetten)

Braucht ein von Confluence-Admins freigeschaltetes/installiertes HTML-Makro (bei euch bereits
vorhanden — im HR Board aktiv genutzt). Damit lässt sich beliebiges CSS/HTML/JS einbetten,
losgelöst von den nativen Confluence-Makros. Wird für maßgeschneiderte Dashboards genutzt statt
für einfache Textbausteine — siehe `references/dynamic-dashboard-pattern.md` für das
vollständige Muster (Design-System + Kombination mit ConfiForm).

```xml
<ac:structured-macro ac:name="html" ac:schema-version="1">
  <ac:plain-text-body><![CDATA[
{{EIGENES_HTML_ODER_STYLE}}
]]></ac:plain-text-body>
</ac:structured-macro>
```

## ConfiForm Live-Liste (`confiform-plain`) — datengetriebener Block

Braucht die ConfiForm-App (bei euch installiert, Basis des HR Boards). Zieht gefilterte/
sortierte Einträge von einer separaten Datenpflege-Seite und rendert sie per Vorlage. Siehe
`references/dynamic-dashboard-pattern.md` für die vollständige Erklärung (Architektur,
Filter-Syntax, `queryCount()` für Kennzahlen-Kacheln).

```xml
<ac:structured-macro ac:name="confiform-plain" ac:schema-version="1">
  <ac:parameter ac:name="pageTitle">
    <ac:link><ri:page ri:content-title="{{DATENPFLEGE_SEITENTITEL}}" /></ac:link>
  </ac:parameter>
  <ac:parameter ac:name="formName">{{FORMULARNAME}}</ac:parameter>
  <ac:parameter ac:name="filter">{{FILTER_AUSDRUCK}}</ac:parameter>
  <ac:parameter ac:name="sort">{{SORTIERFELD}} asc</ac:parameter>
  <ac:parameter ac:name="limit">{{ANZAHL}}</ac:parameter>
  <ac:plain-text-body><![CDATA[
<div>[entry.{{FELD}}]</div>
]]></ac:plain-text-body>
</ac:structured-macro>
```

---

## Anchor (Sprungmarke)

Für "nach oben"-Links bei langen Seiten.

```xml
<ac:structured-macro ac:name="anchor" ac:schema-version="1">
  <ac:parameter ac:name="">{{ANKER_NAME}}</ac:parameter>
</ac:structured-macro>
```
