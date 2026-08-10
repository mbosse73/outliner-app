# CLAUDE.md

Arbeitsanweisung für Claude Code in diesem Repository.

## Was das hier ist

Ein Outliner als **einzelne HTML-Datei** (`index.html`, rund 3000 Zeilen). Notizen, Aufgaben, Projekte und Wissen liegen in einer Baumstruktur; aus derselben Struktur sollen später weitere Ansichten entstehen. Konzept, Architektur und Stufenplan stehen in [KONZEPT.md](KONZEPT.md) — bitte vor größeren Änderungen lesen.

## Harte Regeln

Diese Punkte sind nicht verhandelbar. Wenn eine Aufgabe sie verletzen würde, erst nachfragen.

1. **Eine Datei.** Alles bleibt in `index.html` — HTML, CSS, JavaScript. Keine weiteren Quelldateien.
2. **Keine Abhängigkeiten.** Kein npm, kein Build, kein Bundler, kein CDN, keine Schriftarten von außen. Nur, was der Browser mitbringt.
3. **Offline.** Die Datei muss per Doppelklick aus dem Dateisystem laufen, ohne Server und ohne Netz. Kein `fetch` auf fremde Adressen.
4. **Nur hell.** Kein Dunkelmodus, auch kein optionaler. `color-scheme: only light` und der Block unter `@media (prefers-color-scheme:dark)` bleiben bestehen — sie hindern mobile Browser daran, die Seite selbst umzufärben.
5. **Kein `localStorage` außer über die vorhandenen Funktionen** `save()` und `load()`, Schlüssel `outliner.v1`. Ändert sich das Datenformat, muss `load()` alte Stände weiter lesen können.
6. **Deutsche Oberfläche.** Alle sichtbaren Texte, Meldungen und Beschriftungen auf Deutsch. Auch Kommentare und neue Funktionsnamen sind deutsch, wo das lesbar bleibt (`faltenUmschalten`, `springeZu`, `setzeSuche`).
7. **Keine Browser-Dialoge für Routine.** `confirm` nur beim Verwerfen aller Daten. Rückmeldung sonst über `toast()`.

## Aufbau von index.html

Der `<script>`-Block ist in nummerierte Abschnitte geteilt. Eine Änderung gehört in ihren Abschnitt, nicht ans Ende.

| Abschnitt | Inhalt |
|---|---|
| 1 Datenmodell | `nodes`-Map, `makeNode`, `seed()` |
| 2 Änderungen und Undo | `begin` / `touch` / `commit`, `undo`, `redo`, `recordText` |
| 3 Strukturbefehle | `indent`, `outdent`, `moveVertical`, `toggleFold`, Einfügen und Löschen |
| 4 Suche, Tags, Filter | `tagsOf`, `parseQuery`, `trifft`, `baueFilter`, `visibleRows` |
| 5 Rendern | `buildRow`, `updateRow`, `male`, `schmuecke`, `render` |
| 6 Cursor | `getCaret`, `setCaret`, `focusNode`, `applyFocus` |
| 7 Fokusmodus | `zoomTo`, `zoomOut` |
| 8 Tastatur | ein `keydown` auf `document`, Reihenfolge ist bedeutsam |
| 9 Eingaben übernehmen | `commitField`, `input`- und `focus`-Ereignisse |
| 10 Speichern | `save`, `load`, `scheduleSave` |
| 11 Datei | JSON- und Markdown-Ausgabe (ganz oder je Zweig), JSON- und Markdown-Import, Menü |
| 12 / 12b | `toast`, Suche, Favoriten, Befehlspalette |
| 13 Ansichten | `setzeAnsicht`, `zeichneGantt`, `zeichneKalender`, `zeichneMindmap`, `spannenRechner` |
| 14 Start | Laden oder `seed()`, erstes `render` |

## Die zwei tragenden Entscheidungen

**Ein Datenmodell, viele Projektionen.** Nodes liegen flach in `nodes`, der Baum ergibt sich aus `parentId` und `children`. Jede Ansicht ist nur eine andere Lesart derselben Daten. Neue Ansichten (Kanban, Kalender, Gantt, Mindmap) werden als weitere Projektion gebaut — **niemals als zweiter Datenbestand**, der abgeglichen werden müsste.

**Undo ist ein Befehlsstapel auf dem Datenmodell, nicht auf dem DOM.** Jede Änderung läuft so:

```js
begin("Beschriftung");   // Beschriftung erscheint im Hinweis nach Strg+Z
touch(id);               // vor jeder Änderung an einem Node, auch am Elternteil
nodes[id].feld = wert;
commit();
```

`touch` muss **jeden** Node erfassen, der sich ändert — auch den Elternteil, wenn sich `children` ändert. Wird das vergessen, ist der Schaden erst beim Rückgängigmachen sichtbar, und dann ist er still. Das ist die häufigste Fehlerquelle in dieser Datei.

## Rendern

`render(restoreFocus)` baut nicht neu auf, sondern gleicht ab: Zeilen werden über ihre id wiederverwendet, nur Veränderungen landen im DOM. Wer eine Zeile neu zeichnet, muss `updateRow` erweitern, nicht `buildRow` zusätzlich aufrufen.

`male(el, wert)` schreibt beim Tippen reinen Text ins Feld und sonst die ausgezeichnete Fassung mit Tags und Trefferhervorhebung. Damit bleibt der Cursor unberührt. **Niemals `innerHTML` auf ein Feld setzen, in dem gerade geschrieben wird.**

Nach strukturellen Änderungen `focusState` setzen und `render(true)` aufrufen, sonst springt der Cursor.

## Gestaltung

Die Oberfläche folgt dem Token-System des zugehörigen Dashboards. Farben und Schriften **nur** über die Variablen in `:root`, nie als feste Werte im Regelwerk.

| Rolle | Variable |
|---|---|
| Flächen | `--paper`, `--sheet`, `--raise` |
| Linien | `--rule`, `--rule2` |
| Schrift | `--ink`, `--ink2`, `--ink3` |
| Interaktion, Fokus, aktiver Zustand | `--tinte` |
| Überfällig, Warnung, Löschen | `--signal` |
| Erledigt | `--gut` |

- Serif (`--serif`) nur für Titel
- Monospace (`--mono`) für Etiketten, Zeiten, Zähler, Tastenkürzel — nie für Inhalte
- Sans (`--ff`) für alles Geschriebene
- Abschnittsüberschriften: Versalien in Monospace, `letter-spacing:.16em`, daneben eine Haarlinie
- Listenzeilen: `border-left:2px solid transparent`, im aktiven Zustand `--tinte`, Hintergrund `--sheet`

Zurückhaltung ist Absicht. Keine Verläufe, keine Schlagschatten außer bei schwebenden Flächen (Menü, Palette, Hinweis), keine zusätzlichen Akzentfarben.

## Prüfen vor dem Abgeben

Es gibt keine Testsuite. Diese Wege bitte von Hand durchgehen, in einem Browser mit leerem `localStorage` und einmal mit vorhandenen Daten:

- Enter, Tab, Umschalt+Tab, Alt+Pfeil, Rücktaste am Zeilenanfang — Cursor bleibt jeweils, wo er hingehört
- Strg+Z macht **jede** dieser Änderungen vollständig rückgängig, Strg+Umschalt+Z stellt wieder her
- Suchen, dabei tippen, Esc — Filter geht auf und wieder weg, ohne dass Punkte verschwinden
- In einen Punkt springen und wieder heraus, auch bei einem Punkt ohne Unterpunkte
- Neu laden: alles ist noch da
- Sicherung speichern, verwerfen, Sicherung öffnen — Stand ist identisch

Für automatische Prüfungen eignet sich jsdom in einem Wegwerf-Verzeichnis außerhalb des Repos. Achtung: jsdom fokussiert `contenteditable` nicht, im Test hilft ein vorübergehendes `tabindex="0"`.

## Was als Nächstes ansteht

Stufe 1 bis 3 sind fertig, von Stufe 4 sind Gantt, Kalender und Mindmap gebaut, Stufe 6 ist fertig.

Zwei Regeln aus Stufe 6, die nicht „aufgeräumt" werden dürfen:

- **`visibleRows()` ist die einzige Stelle, die Archiviertes ausblendet.** Weil alle Ansichten von dort lesen, gilt es überall. Wer daneben eine zweite Prüfung einbaut, erzeugt Abweichungen zwischen den Ansichten — und übersieht dabei leicht den Kalender, der `visibleRows(true)` nimmt.
- **Markdown-Import fügt am Fokus ein und ersetzt nie.** Nur die JSON-Öffnung ersetzt den Bestand. Das ist Absicht, keine Lücke.

**Zurückgestellt und ausdrücklich keine Zusage: Kanban und die gesamte Stufe 5.** Beides nicht anfangen, ohne dass jemand es erneut verlangt — auch nicht in Teilen und auch nicht, weil KONZEPT.md die Stufen aufzählt. Der Stufenplan dort ist eine Absichtserklärung, kein offener Auftrag.

Damit steht derzeit **nichts** an. Wer hier weiterarbeiten soll, bekommt es gesagt.

Neue Ansichten sind Projektionen: sie lesen `rowIndex`, damit Fokus, Zuklappen und Suche ohne Zutun gelten. Keine Ansicht erfindet eigene Sichtbarkeitsregeln.

Eine einzige Abweichung ist bewusst und muss so bleiben: Der **Kalender** nimmt `visibleRows(true)` statt `rowIndex` und übergeht damit das Zuklappen. Fokus und Suche sind absichtliche Einschränkungen, ein zugeklappter Zweig ist nur eine Lesehilfe der Gliederung — er darf keine Termine still entfernen. Dieselbe Funktion ignoriert Zuklappen ohnehin schon, sobald gefiltert wird. Wer das für ein Versehen hält und „aufräumt", baut den Fehler wieder ein.

## Umgang mit Aufgaben

- Kleine, gezielte Eingriffe. Keine Umbenennungen und keine Umstrukturierung nebenbei.
- Vorhandene Muster fortführen, statt eigene einzuführen.
- Bei Unklarheit über Bedienung oder Gestaltung nachfragen, statt zu raten — die Vorgaben hier sind bewusst eng.
- Datenverlust ist der teuerste Fehler dieser App. Im Zweifel die vorsichtigere Variante wählen und den Hinweis sichtbar machen.
