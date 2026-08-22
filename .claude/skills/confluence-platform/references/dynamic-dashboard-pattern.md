# Muster: Datengetriebenes Dashboard (wie HR-Betriebsratsboard)

Dieses Muster stammt aus einem echten Storage-Format-Export des bestehenden HR Boards
(siehe `SKILL.md`, Schritt 0) und ist der eigentliche Grund, warum der Aufbau Wochen gedauert
hat: Es ist **kein** einfacher Satz aus Standard-Confluence-Makros, sondern eine Kombination
aus zwei Bausteinen, die zusammenspielen. Interne Identifikatoren (Domain, Seiten-IDs,
Account-Pfade) wurden hier durch `{{PLATZHALTER}}` ersetzt.

## Architektur: zwei Seiten, eine Anzeige

1. **Datenpflege-Seite** (`{{PLATTFORM_NAME}} - Datenpflege`): enthält **ConfiForm**-Formulare
   — je Dateneinheit ein Formular (z. B. `boardStatus` für den Gesamtstatus, `boardSitzungen`
   für Sitzungstermine, `brThemen` für Einzelthemen mit Priorität/Owner/Frist, `boardTeam` für
   die Team-Zusammensetzung). Wer die Seite pflegt, trägt hier Daten in normale Formularfelder
   ein — kein HTML, kein Storage-Format nötig für die laufende Pflege. Der vollständige Aufbau
   dieser Seite (Formular-Definition, Feldtypen, Eintragen-Button, Tabelle mit Bearbeiten/
   Löschen) ist in `references/confiform-datenpflege-recipe.md` dokumentiert — die Session
   kann daraus die komplette Datenpflege-Seite als eigene `.storage.xml` mitgenerieren, nicht
   nur die Anzeige-Seite.
2. **Anzeige-Seite** (das eigentliche Dashboard/Board): rein optisch aus HTML/CSS aufgebaut
   (`html`-Makro), die tatsächlichen Werte kommen aber **live** aus der Datenpflege-Seite via
   `confiform-plain`-Makros, die pro Formular filtern, sortieren, begrenzen und in ein
   HTML-Schnipsel-Template einsetzen.

Das ist der entscheidende Vorteil gegenüber einer rein statischen Seite: Wer das Board pflegt,
bearbeitet nur die Datenpflege-Seite (Formulareinträge) — das Dashboard selbst muss nie
angefasst werden, weil es sich automatisch aktualisiert.

**Voraussetzung:** ConfiForm muss als App in der Confluence-Instanz installiert sein (bei euch
der Fall, da es im HR Board bereits produktiv läuft) und das `html`-Makro muss von einem Admin
freigeschaltet sein (ebenfalls bereits der Fall).

## Baustein A: `confiform-plain` — gefilterte/sortierte Live-Liste

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
<div class="{{PREFIX}}-row">
  <div>[entry.{{FELD}}]</div>
  <div>[entry.{{FELD2}}.label]</div>
</div>
]]></ac:plain-text-body>
</ac:structured-macro>
```

- **`pageTitle`**: Link auf die Datenpflege-Seite — muss exakt deren Titel treffen.
- **`formName`**: Name des ConfiForm-Formulars auf der Datenpflege-Seite.
- **`filter`**: einfache Ausdrücke, z. B. `datum:>=[today]` (kommende Termine),
  `datum:<[today]` (vergangene), `managementFokus:ja` (Boolean-Feld), `bereich:topThema`
  (Textfeld-Gleichheit). `[today]` ist ein eingebautes Datums-Token, auch `[today]+14`
  (heute plus 14 Tage) funktioniert.
- **`sort`**: Feldname + `asc`/`desc`. Kann auch mit `LIMIT n` in einem Ausdruck kombiniert
  auftreten (z. B. `datum ASC LIMIT 1`), zusätzlich zum separaten `limit`-Parameter — im
  Original-Export kommen beide Varianten vor, im Zweifel den separaten `limit`-Parameter
  bevorzugen, das ist die zuverlässigere Variante.
- **Template im CDATA-Block**: beliebiges HTML mit Platzhaltern `[entry.<feldname>]`. Für
  Referenzfelder auf Personen: `[entry.<feld>.firstName]` / `.lastName`. Für Auswahlfelder
  (Select/Radio) mit Label: `[entry.<feld>.label]`. Für Datumsfelder: Formatierung per
  `[entry.<feld>.formatDate(dd.MM.yyyy)]`, mit Zeitzone `formatDate(HH:mm, Europe/Berlin)`.

### Aggregat-Zähler: `queryCount()`

Für Kennzahlen-Karten ("X Themen mit Entscheidungsbedarf"), ohne die Liste selbst
auszugeben:

```
[entry.id.queryCount({{FORMULARNAME}}:{{DATENPFLEGE_SEITEN_ID}};{{FELD}}:{{WERT}})]
```

Die `{{DATENPFLEGE_SEITEN_ID}}` ist die numerische Seiten-ID der Datenpflege-Seite (aus deren
URL). `{{WERT}}` kann `*` sein für "alle Einträge zählen".

## Baustein B: `html`-Makro — visuelle Hülle

```xml
<ac:structured-macro ac:name="html" ac:schema-version="1">
  <ac:plain-text-body><![CDATA[
<div class="{{PREFIX}}-card">
  ...
</div>
]]></ac:plain-text-body>
</ac:structured-macro>
```

Wird abwechselnd mit `confiform-plain`-Blöcken eingesetzt: ein `html`-Block öffnet ein
Grid/eine Karte, ein oder mehrere `confiform-plain`-Blöcke füllen die Live-Zeilen, ein
weiterer `html`-Block schließt den Container wieder. So entsteht z. B. eine "Tabelle" rein aus
CSS-Grid-`div`s (`{{PREFIX}}-live-head` / `{{PREFIX}}-live-row`) statt aus einer echten
HTML-Tabelle — das macht die Zeilen einfacher per Template zu erzeugen.

**Wichtig beim Nachbau:** CSS wird nur **einmal pro Seite** definiert (ein `<style>`-Block im
ersten `html`-Makro reicht, da es serverseitig einfach in die Seite eingebettet wird) —
nicht in jedem `html`-Block wiederholen.

## Wiederverwendbare Design-System-Bausteine aus dem HR Board

Diese Elemente sind generisch genug, um für jede neue Plattform übernommen zu werden — beim
Einsatz `{{PREFIX}}` durch ein plattformspezifisches Kürzel ersetzen (z. B. `xyz-` statt
`hrbr-`), damit sich CSS-Klassen mehrerer Plattform-Seiten im selben Space nicht überschneiden:

- **Hero-Header**: zweispaltig (Text + Illustration/Icon-Kachel), Gradient-Hintergrund,
  großer Titel + Unterzeile + Fließtext.
- **Kennzahlen-Karten-Reihe** (`{{PREFIX}}-cards`): 4 Karten nebeneinander, je mit rundem
  Farb-Icon, Label, großem Wert, kleinem Zusatztext — ideal in Kombination mit
  `confiform-plain` + `queryCount()` für Live-Kennzahlen. Als `<a>`-Element klickbar zu einem
  Anker (`href="#abschnitt"`) auf derselben Seite.
- **Schnellnavigation** (`{{PREFIX}}-nav`): horizontale Pillen-Links zu Ankern der Seite.
- **Live-Tabelle als CSS-Grid** (`{{PREFIX}}-live-head`/`-row`): "Tabelle" ohne `<table>`,
  Spalten per `grid-template-columns`, dadurch leichter mit Pills/Badges pro Zelle kombinierbar.
- **Status-/Prio-Pills** (`{{PREFIX}}-pill2` mit `data-status`/`data-prio`-Attributen): Farbe
  wird rein über CSS-Attribut-Selektoren gesteuert (`[data-status="Offen"] { background: ...}`)
  — neue Status-Werte einfach als weiteren CSS-Selektor ergänzen, kein JS nötig.
- **Reines CSS-Akkordeon ("Management Attention"-Liste)**: Trick über verstecktes
  `<input type="checkbox">` + `<label>` + `:checked ~ .detail { display:block; }` — klappt
  Detail-Text auf, ganz ohne JavaScript. Gut für "Themen mit Handlungsbedarf",
  FAQ-artige Listen oder Fristen-Übersichten.
- **2er-/3er-Karten-Reihe unten** (`{{PREFIX}}-lower-2cards` / `-lower-3cards`): responsive
  Grid/Flex-Layout für z. B. "Nächste Sitzung" / "Kommende Termine" / "Vergangene Meetings"
  nebeneinander.
- **Kreisdiagramm für Org-Struktur** (`{{PREFIX}}-circle` mit `{{PREFIX}}-center` +
  `{{PREFIX}}-node.n1..n5`): zentrales Element + 5 absolut positionierte Knoten drumherum,
  rein mit `position:absolute`-Koordinaten. Gut für "Wer gehört zum Board" / Gremien-Übersicht.
- **Prozess-Schritte-Kette** (`{{PREFIX}}-process-row` mit `{{PREFIX}}-step` +
  `{{PREFIX}}-arrow`): nummerierte Schritte mit Pfeilen dazwischen, auf Mobile automatisch
  untereinander (Pfeil gedreht statt versteckt).
- **"Wissenswert"-Abschnitt**: Warum-gibt-es-das-Board-Erklärung (Ausgangslage + Zielbild) plus
  Vorteile-Kacheln — guter Onboarding-Ersatz für Leute, die neu auf die Plattform stoßen.
- **Aufklappbare Detailbereiche** (`expand`-Makro) mit eigenem Tabellen-Styling
  (`.expand-content table.confluenceTable ...`) für Inhalte, die nicht dauerhaft sichtbar sein
  müssen (z. B. vollständige Teamliste).

Das vollständige, generalisierte CSS für diese Bausteine liegt (mit `{{PREFIX}}`-Platzhaltern)
in `references/dashboard-design-system.css` — dort direkt kopieren, `{{PREFIX}}` per
Suchen-und-Ersetzen auf das neue Plattform-Kürzel setzen, fertig.

## Wann dieses Muster wählen, wann nicht

- **Datengetrieben (dieses Muster) nutzen, wenn:** mehrere Personen die Inhalte regelmäßig
  pflegen (Status ändert sich laufend), Live-Kennzahlen/Zähler gewünscht sind, oder Filterung/
  Sortierung (z. B. "nur offene Fristen") gebraucht wird.
- **Statisch (Blueprint aus `references/blueprint-storage.xml`) reicht, wenn:** die Seite
  selten aktualisiert wird, nur eine Person pflegt, oder kein ConfiForm-Formular für die neue
  Dateneinheit existiert und der Aufwand, eines anzulegen, sich für den Anwendungsfall nicht
  lohnt.
