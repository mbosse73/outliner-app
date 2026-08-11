# Pruefungen

Reines Entwicklerwerkzeug für Claude Code — kein Teil der ausgelieferten App.
`index.html` bleibt die einzige Quelldatei, die im Browser läuft; alles hier
setzt Node und Playwright voraus und wird nie verlinkt oder ausgeliefert.

## Einrichten (einmal je Sitzung/Umgebung)

```
cd tests
npm install
```

In dieser Entwicklungsumgebung ist Chromium bereits vorinstalliert
(`/opt/pw-browsers/chromium`); `npm install` holt dann nur das
`playwright`-Paket selbst, ohne erneut einen Browser herunterzuladen.

## Ausführen

```
cd tests
node alle.js            # alle Suiten nacheinander
node alle.js s6.js       # nur eine einzelne Suite, zum gezielten Nachpruefen
```

Jede Datei ist eigenständig lauffähig (`node datum.js` genügt auch ohne
`alle.js`). Jede Suite startet einen kurzlebigen lokalen HTTP-Server für
`../index.html` und einen Chromium-Kopf, prüft eine Reihe von Verhalten mit
Playwright und meldet am Ende `N ok, M Fehler`. Ein Prozess endet mit
Exitcode ungleich 0, sobald eine Prüfung fehlschlägt oder ein Skriptfehler
auf der Seite auftrat — geeignet für einen Hook oder eine Kette von
Befehlen.

## Was jede Suite prüft

| Datei | Bereich |
|---|---|
| `pruefe.js` | Grundgerüst: Tastatur, Undo/Redo, Suche, Fokus, Speichern/Laden, Datei-Export |
| `stufe3b.js` | Priorität, Zeitraum, Fortschritt, Sicht „Wichtig" |
| `zusatz.js` | Frist folgt dem Text beim Teilen/Verbinden einer Zeile |
| `s4.js` | Gantt: Balken, Rauten, zusammenfassende Elternbalken |
| `s4k.js` | Kalender: Monat/Woche/Tag, `visibleRows(true)` ignoriert Zuklappen |
| `waisen.js` | Regressionstest: keine verwaisten Nodes nach Rückgängigmachen |
| `s6.js` | Zweig-Export, Markdown-Import, Archiv |
| `datum.js` | Deutsches Datumsformat, Regex-Grenzfälle, Rückwärtskompatibilität zu ISO |
| `dpicker.js` | Eigener Datumswähler (Symbol, Fenster, Tastatursperre währenddessen) |
| `mmtest.js` | Mindmap: Typen, Farbthemen, eigenes Klappen, HTML-Export |

## Vor jeder Änderung an `index.html`

Alle Suiten müssen grün bleiben — `node alle.js` vor jedem Commit. Trifft
eine Änderung ein gemeinsam genutztes Stück (`visibleRows()`, `touch`/
`commit`, `FRIST_RE`, `mindmapLayout()` …), reicht ein Blick auf die
betroffene Suite nicht: mehrere Ansichten lesen dieselbe Stelle.

Für eine neue Eigenschaft eine neue Datei anlegen, statt eine bestehende
Suite zweckzuentfremden — der Dateiname soll weiterhin sagen, was geprüft
wird. Screenshot-Skripte (keine Prüfsuite, nur ein Bild zur Kontrolle)
gehören nicht hierher, sondern ins Scratchpad der jeweiligen Sitzung.
