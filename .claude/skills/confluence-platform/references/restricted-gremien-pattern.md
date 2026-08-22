# Muster: Mandantengetrennte Gremien-/Gruppen-Seiten

Ergänzt `references/dynamic-dashboard-pattern.md` um einen Fall, den das HR Board nicht
abdeckt: mehrere Gremien/Gruppen tauschen sich mit derselben Stelle (z. B. HR) aus, aber
**nicht alle dürfen alles sehen**. Entstanden aus dem Anforderungsgespräch zur
HR-BR-Austauschplattform (mehrere Betriebsräte auf verschiedenen Ebenen — örtlich, GBR, KBR —
jeweils mit eigenen, vertraulichen Themen gegenüber HR).

## Warum eine zentrale Datenpflege-Seite hier NICHT passt

Im HR-Board-Muster (`dynamic-dashboard-pattern.md`) liegen alle ConfiForm-Formulare auf
**einer** gemeinsamen Datenpflege-Seite. Das funktioniert, weil dort ein einziges Publikum
(HR intern) alles sehen darf. Sobald mehrere Gremien beteiligt sind, die sich gegenseitig
**nicht** einsehen dürfen sollen, würde eine gemeinsame Datenpflege-Seite genau das verhindern,
was gefordert ist: Gremium A könnte die Einträge von Gremium B sehen, sobald beide Zugriff auf
dieselbe Seite haben.

**Lösung:** Jede geschützte Einheit (Gremium, Ausschuss, Standort-BR) bekommt eine **eigene**
Seite, die zugleich Formular **und** Ansicht ist (Datenpflege und Anzeige auf derselben Seite
kombiniert) — keine gemeinsame Datenpflege-Seite mehr. Erst darüber liegt eine
Landing-/Übersichtsseite (öffentlich im Space) und optional eine HR-only-Auswertungsseite.

## Seitenstruktur

```
HR-BR Austauschplattform (Landing, sichtbar für alle mit Space-Zugriff)
├── GBR AG                      [eingeschränkt: Gruppe "gbr-ag" + HR]
├── GBR Service                 [eingeschränkt: Gruppe "gbr-service" + HR]
├── KBR                         [eingeschränkt: Gruppe "kbr" + HR]
├── Örtlicher BR – <Standort>   [eingeschränkt: Gruppe "br-<standort>" + HR] (pro Standort, Rollout Phase 2)
└── HR-Übersicht                [eingeschränkt: nur HR-Gruppe]
```

Jede Gremium-Seite enthält für sich:
1. Ein ConfiForm-Formular + Tabelle für **einseitige Meldungen** (BR → HR, z. B.
   Gremiumszusammensetzung, Wahlergebnis, Freistellungen) — Syntax siehe
   `references/confiform-datenpflege-recipe.md`.
2. Optional ein zweites Formular + Tabelle für **wechselseitigen Austausch** (Themen mit
   Status/Owner/nächstem Schritt, die beide Seiten einsehen und kommentieren) — analog zum
   `brThemen`-Muster aus dem HR Board, aber auf diese eine Gremium-Seite beschränkt statt
   zentral.

## Zugriffsbeschränkung setzen

**Voraussetzung:** Confluence-Gruppen pro Gremium müssen existieren (Confluence-Administration
oder Active-Directory-Anbindung — vorher klären, siehe Interview-Antwort "weiß ich noch
nicht"). Ohne solche Gruppen bleibt nur die Beschränkung auf einzelne Personen, was bei
wechselnden Gremiumsmitgliedern pflegeintensiv ist.

- **Manuell in der UI:** Seite öffnen → "..." → "Beschränkungen" → "Nur bestimmte Personen
  können diese Seite anzeigen" → Gruppe(n) hinzufügen, für Lesen und Bearbeiten getrennt
  einstellbar.
- **Automatisiert:** `scripts/publish-to-confluence.mjs` unterstützt jetzt
  `--restrict-groups "gruppe1,gruppe2"` — setzt Lese- **und** Bearbeiten-Beschränkung auf genau
  diese Gruppen in einem Aufruf, direkt nach dem Anlegen/Aktualisieren der Seite.

**Wichtig:** Eine Beschränkung auf eine Elternseite vererbt sich **nicht** automatisch auf neue
Kindseiten in jeder Confluence-Version zuverlässig — nach dem Anlegen jeder Gremium-Seite die
Beschränkung prüfen, nicht nur bei der Landing-Seite setzen und annehmen, es reicht.

## Ungeklärter Punkt vor Go-Live: Cross-Page-Aggregation und Berechtigungen

Für die "HR-Übersicht"-Seite ist es naheliegend, `confiform-plain` so einzusetzen, dass sie
Daten von den einzelnen (eingeschränkten) Gremium-Seiten zusammenzieht — genau wie im HR-Board-
Muster, nur über mehrere Quellseiten hinweg. **Das ist hier nicht ungeprüft zu empfehlen:**
Ob ConfiForm beim Lesen einer fremden Seite die Seitenbeschränkung der Quellseite respektiert
oder mit den Rechten des ConfiForm-Systemnutzers liest (und damit versehentlich beschränkte
Daten auf der HR-Übersicht sichtbar machen könnte, wenn diese nicht ebenfalls ausreichend
eingeschränkt ist), hängt von der ConfiForm-Version/Konfiguration ab und lässt sich ohne
Zugriff auf die Instanz nicht verifizieren.

**Empfehlung:** Vor Go-Live mit einem Test-Account (Mitglied nur einer der Gremium-Gruppen,
kein HR) prüfen, ob die HR-Übersicht-Seite tatsächlich nur das zeigt, was dieser Account auch
direkt auf den Gremium-Seiten sehen dürfte. Falls ConfiForm hier nicht sauber trennt: die
HR-Übersicht selbst ausreichend einschränken (nur HR-Gruppe) reicht dann aus, **so lange
niemand außer HR auf die HR-Übersicht-Seite selbst zugreifen kann** — die Beschränkung der
Übersichtsseite wird dann zur alleinigen Schutzgrenze, nicht die der Quellseiten.

## Wann dieses Muster statt des zentralen HR-Board-Musters wählen

- **Dieses Muster (getrennte Seiten pro Gremium):** sobald zwei oder mehr Gruppen sich
  gegenseitig nicht einsehen dürfen sollen.
- **Zentrales HR-Board-Muster (eine Datenpflege-Seite):** wenn es nur ein Publikum mit
  einheitlichem Zugriff gibt (wie bei einem rein internen HR-Board).
