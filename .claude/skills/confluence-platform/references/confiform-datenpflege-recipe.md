# Rezept: Datenpflege-Seite mit ConfiForm aufbauen

Ergänzt `references/dynamic-dashboard-pattern.md` um die fehlende Hälfte: wie die
**Datenpflege-Seite** selbst aufgebaut wird (die Seite, von der `confiform-plain` auf der
Anzeige-Seite liest). Stammt aus einem echten Storage-Format-Export der bestehenden
HR-BR-Board-Datenpflegeseite — interne Seiten-ID wurde durch `{{DATENPFLEGE_SEITEN_ID}}`
ersetzt.

Pro Dateneinheit (z. B. "Themen", "Sitzungen", "Team") braucht die Datenpflege-Seite **drei**
Bausteine hintereinander: (1) Formular-Definition mit Eingabe-Feldern, (2) den
"Neuen-Eintrag"-Button, der das Formular öffnet, (3) eine Tabelle, die alle bestehenden
Einträge mit Bearbeiten-/Löschen-Funktion zeigt.

## Baustein 1+2: Formular-Definition + Eintragen-Button

```xml
<ac:structured-macro ac:name="confiform" ac:schema-version="1">
  <ac:parameter ac:name="formName">{{FORMULARNAME}}</ac:parameter>
  <ac:parameter ac:name="registrationFormTitle">{{FORMULAR_TITEL}}</ac:parameter>
  <ac:rich-text-body>

    <!-- Ein confiform-field-definition-Block pro Eingabefeld, beliebig oft wiederholen -->
    <ac:structured-macro ac:name="confiform-field-definition" ac:schema-version="1">
      <ac:parameter ac:name="fieldName">{{FELDNAME}}</ac:parameter>
      <ac:parameter ac:name="fieldLabel">{{FELD_LABEL}}</ac:parameter>
      <ac:parameter ac:name="type">{{FELDTYP}}</ac:parameter>
      <ac:parameter ac:name="required">true</ac:parameter>
    </ac:structured-macro>

    <!-- Der Eintragen-Button gehört ans Ende desselben confiform-Blocks -->
    <ac:structured-macro ac:name="confiform-entry-register" ac:schema-version="1">
      <ac:parameter ac:name="formName">{{FORMULARNAME}}</ac:parameter>
      <ac:parameter ac:name="registrationButtonLabel">{{BUTTON_TEXT}}</ac:parameter>
      <ac:rich-text-body><p><br /></p></ac:rich-text-body>
    </ac:structured-macro>

  </ac:rich-text-body>
</ac:structured-macro>
```

### Feldtypen (`type`), alle im echten Export vorkommend

| `type`       | Wofür                          | Zusätzliche Parameter |
|--------------|----------------------------------|------------------------|
| `text`       | einzeiliger Text                 | `fieldDescription` (Hilfetext unter dem Feld) |
| `textarea`   | mehrzeiliger Text                | — |
| `markdown`   | mehrzeiliger Text mit Formatierung | — |
| `select`     | Dropdown mit festen Optionen     | `values` (siehe unten) |
| `user`       | Personen-Picker (Confluence-Nutzer) | — |
| `date`       | Datumsfeld                       | `extras` = Format, z. B. `dd.MM.yyyy` |
| `time`       | Uhrzeitfeld                      | `extras` = Format, z. B. `HH:mm` |
| `smartselect`| Dropdown, das Einträge eines **anderen** Formulars referenziert (Verknüpfung zwischen Dateneinheiten) | `values` im Format `[{{QUELL_SEITEN_ID}}\|{{QUELL_FORMULARNAME}}\|{{QUELL_FELDNAME}}\|true\|\|]` |

Jedes Feld kann zusätzlich `required` (`true`/`false`) und `fieldDescription` (Hilfetext)
haben.

### `select`-Optionen (`values`-Syntax)

```
false[wert1=Anzeigetext 1|wert2=Anzeigetext 2|wert3=Anzeigetext 3|]
```

Das führende `false` steuert, ob Mehrfachauswahl erlaubt ist (`true` = Mehrfachauswahl).
Jede Option ist `interner-wert=Anzeigetext`, getrennt durch `|`, der Ausdruck endet mit `|]`.
Der interne Wert ist das, was in `confiform-plain`-Filtern auf der Anzeige-Seite verwendet
wird (z. B. `managementFokus:ja`), der Anzeigetext ist das, was `[entry.feld.label]` ausgibt.

**Praxisbeispiel (Status-Feld, 1:1 aus dem echten Export):**

```
false[offen=Offen|inKlaerung=In Klärung|laeuft=Läuft|entscheidungNoetig=Entscheidung nötig|achtung=Achtung|erledigt=Erledigt|]
```

### Verknüpfte Formulare (`smartselect`)

Wenn eine Dateneinheit auf eine andere verweisen soll (z. B. "Verhandlungstermin" gehört zu
einem bestehenden "Thema"), referenziert man das Quellformular statt eine eigene Werteliste zu
pflegen:

```xml
<ac:structured-macro ac:name="confiform-field-definition" ac:schema-version="1">
  <ac:parameter ac:name="fieldName">thema</ac:parameter>
  <ac:parameter ac:name="fieldLabel">Thema</ac:parameter>
  <ac:parameter ac:name="values">[{{DATENPFLEGE_SEITEN_ID}}|brThemen|thema|true||]</ac:parameter>
  <ac:parameter ac:name="type">smartselect</ac:parameter>
  <ac:parameter ac:name="required">true</ac:parameter>
</ac:structured-macro>
```

`{{DATENPFLEGE_SEITEN_ID}}` ist hier die eigene Seiten-ID der Datenpflege-Seite (aus deren
URL) — da beide Formulare i. d. R. auf derselben Datenpflege-Seite liegen.

## Baustein 3: Tabelle mit Bearbeiten/Löschen

```xml
<ac:structured-macro ac:name="confiform-table" ac:schema-version="1">
  <ac:parameter ac:name="formName">{{FORMULARNAME}}</ac:parameter>
  <ac:parameter ac:name="messageToShowWhenEmpty">{{LEER_TEXT}}</ac:parameter>
  <ac:parameter ac:name="sort">{{SORTIERFELD}} ASC</ac:parameter>
  <ac:rich-text-body>

    <ac:structured-macro ac:name="confiform-entry-edit" ac:schema-version="1">
      <ac:parameter ac:name="editButtonLabel">Bearbeiten</ac:parameter>
      <ac:parameter ac:name="deleteButtonLabel">Löschen</ac:parameter>
      <ac:parameter ac:name="updateMessage">Eintrag gespeichert.</ac:parameter>
      <ac:rich-text-body><p><br /></p></ac:rich-text-body>
    </ac:structured-macro>

    <!-- Ein confiform-field-Block pro Spalte, die in der Tabelle sichtbar sein soll -->
    <ac:structured-macro ac:name="confiform-field" ac:schema-version="1">
      <ac:parameter ac:name="fieldName">{{FELDNAME}}</ac:parameter>
      <ac:parameter ac:name="overrideLabel">{{SPALTEN_LABEL}}</ac:parameter>
    </ac:structured-macro>

  </ac:rich-text-body>
</ac:structured-macro>
```

`sort` ist optional. `confiform-field` steuert, welche Felder als Spalten erscheinen und mit
welcher Überschrift — nicht zwangsläufig alle Formularfelder müssen hier auftauchen.

## Vollständiger Ablauf pro Dateneinheit

1. Überschrift + kurzer Erklärtext, was hier gepflegt wird.
2. Baustein 1+2 (Formular + Eintragen-Button).
3. Überschrift "Erfasste {{DATENEINHEIT}}" + kurzer Erklärtext.
4. Baustein 3 (Tabelle mit Bearbeiten/Löschen).
5. Optische Trennung zur nächsten Dateneinheit (im Original per `<hr>`-ähnlichem
   Sternchen-Absatz, alternativ ein Confluence-`<hr />` oder ein `divider`-Makro verwenden).

Das Ganze mehrfach wiederholen — einmal pro Formular/Dateneinheit, die die neue Plattform
braucht (z. B. Status, Themen/Vorgänge, Termine, Team). Am Seitenanfang lohnt sich ein
`toc`-Makro (siehe `references/macro-library.md`), da die Datenpflege-Seite bei mehreren
Formularen schnell lang wird.
