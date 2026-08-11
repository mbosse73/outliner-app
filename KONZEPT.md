# Konzept und Plan

## Leitidee

Ein Inhalt, viele Ansichten. Alle Informationen liegen als hierarchische Punkte (Nodes) vor, beliebig tief verschachtelt. Ein Punkt kann zugleich Notiz, Aufgabe, Projekt, Dokument, Idee, Wissenseintrag, Termin oder Planungselement sein.

Aus derselben Struktur entstehen verschiedene Darstellungen: Gliederung, Mindmap, Kanban, Gantt, Kalender, Aufgabenliste. Der Benutzer entscheidet nicht vorher, welches Werkzeug er braucht — die Ansicht passt sich der Aufgabe an.

Vorbilder: Workflowy für globale Struktur, Tags, Suche und Fokusmodus. Bike Outliner für Tempo, Tastaturbedienung und dokumentorientiertes Arbeiten.

## Architektur

**Ein Datenmodell, viele Projektionen.** Nodes liegen in einer flachen Map, der Baum ergibt sich aus `parentId` und `children`. Jede Ansicht ist eine andere Lesart derselben Nodes:

- Kanban → Gruppierung nach `task.status`
- Kalender und Gantt → Filter auf `task.start` und `task.due`
- Mindmap → Radial, Baumdiagramm oder Zeitachse desselben Teilbaums, je nach gewähltem Typ
- Aufgabenliste → Filter auf `task != null`

Damit gibt es zwischen den Ansichten nichts zu synchronisieren.

```
Node = {
  id, parentId, children[],
  text, note, collapsed, fav,
  tags[], task: { status, prio, start, due, progress },
  created, modified
}
```

**Undo** ist ein Befehlsstapel auf dem Datenmodell. Eine Transaktion merkt sich den Zustand der berührten Nodes vorher und nachher; Texteingaben innerhalb von 900 ms werden zusammengefasst.

**Rendern** geschieht inkrementell: Zeilen werden über ihre id wiederverwendet, nur veränderte Teile werden neu gezeichnet. Beim Tippen steht reiner Text im Feld, sonst die ausgezeichnete Fassung mit Tags und Trefferhervorhebung — so bleibt der Cursor unberührt.

## Stufen

### Stufe 1 — Kern *(fertig)*
Baum mit unbegrenzter Verschachtelung, Tastaturbedienung, Ein- und Ausklappen, Fokusmodus mit Pfadleiste, Notizzeile, Undo/Redo, Autosave, JSON- und Markdown-Ausgabe.

### Stufe 2 — Organisation *(fertig)*
Globale Suche als gefilterte Gliederung, Tags per `#`, Anheften, Befehlspalette mit Sprungzielen, zuletzt Bearbeitetem und Befehlen.

### Stufe 3 — Aufgaben *(fertig)*
Status, Priorität, Start- und Fälligkeitsdatum, Fortschritt als optionale Eigenschaften eines Punktes, per Tastatur inline gesetzt. Sichten „Heute", „Offen", „Wichtig". Überfälliges in Signalrot.

Abgehakt wird per Klick aufs Kästchen oder über die Befehlspalette. Alles Übrige steht als Zeichen im Text und wird von dort ins Modell gespiegelt — dieselbe Bauart wie die Tags: `@09.03.2026` die Frist, `@von..bis` der Zeitraum, `!hoch` die Priorität, `%50` der Fortschritt. Getippt wird deutsch, auch ohne führende Null oder Jahr (`@9.3.`); intern bleibt ausschließlich ISO — nur die Textsyntax ist deutsch, `task.due` bleibt Wahrheit fürs Modell. Ein kleines Kalender-Symbol neben einem einzelnen Termin öffnet zusätzlich ein selbst gestaltetes Auswahlfenster, kein natives `<input type="date">`. Auch der Palettenbefehl für die Priorität schreibt nur dieses Zeichen in die Zeile; damit bleibt der Text die einzige Wahrheit und es gibt keinen zweiten Ort, der abgeglichen werden müsste.

Die Sichten sind gespeicherte Suchen (`!heute`, `!offen`, `!wichtig`), keine eigene Ansicht — dieselbe Entscheidung wie oben, nur eine Ebene tiefer.

In der Notizzeile gelten die Zeichen nicht: sie ist Prosa.

### Stufe 4 — Weitere Ansichten *(teilweise)*
Kanban mit frei definierbaren Spalten, Kalender in Tag/Woche/Monat, Gantt mit Zeiträumen und Meilensteinen, Mindmap. Alles als SVG und CSS, ohne Bibliothek.

Fertig sind **Gantt**, **Kalender** und **Mindmap**, umschaltbar über die Kopfzeile und die Palette. Alle drei sind Projektionen: sie lesen dieselbe Zeilenauswahl wie die Gliederung, also gelten Fokus und Suche dort unverändert.

Im Gantt wird ein Punkt mit Zeitraum zum Balken, einer mit bloßer Frist zur Raute — der Meilenstein, den dieser Plan schon vorsah. Ein übergeordneter Punkt ohne eigenes Datum bekommt einen zusammenfassenden Balken vom frühesten Anfang bis zur spätesten Frist darunter; gerechnet wird über den ganzen Teilbaum, auch über zugeklappte Kinder. Undatierte Zweige erscheinen gar nicht.

Die Mindmap zeichnet die Verbindungen als SVG-Pfade und die Beschriftungen als HTML darüber, in einem von drei Typen: **Radial** (der ursprüngliche Aufbau), **Baumdiagramm** (von oben nach unten, eckige Kästen) und **Zeitachse** (die Äste der Wurzel auf einer horizontalen Linie nach `spannenRechner()` sortiert, ohne Datum in einer festen Spalte am Rand — verschwinden ist der teuerste Fehler dieser App). Alle drei teilen dieselbe Blattzahl-Rechnung, damit sich nichts überlappt. Dazu ein Farbthema (Tinte, Granit, Ozean), das unabhängig vom Typ gewählt wird und jeden Ast im Teilbaum einheitlich einfärbt. Ein eigenes Klappen (`mmZu`, ein `Set` von Ids) blendet Äste in der Mindmap aus — unabhängig von `node.collapsed`, das die Gliederung betrifft, und nicht gespeichert. „Als HTML exportieren" (Datei-Menü und Palette) legt aus `mindmapLayout(false)` eine eigenständige Datei an: Layout und Klappen funktionieren darin weiter, Bearbeiten nicht.

Der **Kalender** zeigt Monat, Woche und Tag. Ein Zeitraum läuft als Balken über die Tage und bricht am Wochenende um; Überschneidungen rücken in eigene Spuren. Anders als im Gantt gibt es keine Zusammenfassung — ein Monatsfeld hat wenig Platz, und ein Elternbalken nennt keinen wahrnehmbaren Termin. Weil das Modell nur Tage kennt, ordnet die Tagesansicht nicht nach der Uhr, sondern benennt den Zustand: läuft, beginnt, endet, fällig.

Eine bewusste Abweichung: **Zuklappen wirkt nicht auf den Kalender.** Fokus und Suche sind absichtliche Einschränkungen, ein zugeklappter Zweig ist nur eine Lesehilfe der Gliederung — er darf keine Termine still entfernen. Technisch über `visibleRows(true)`; dieselbe Funktion ignoriert Zuklappen ohnehin schon, sobald gefiltert wird.

**Kanban ist zurückgestellt und gilt nicht als Zusage** — ob es überhaupt kommt, ist offen. Es bräuchte zwei Eingriffe ins Datenmodell: `task.status` kennt nur `offen` und `erledigt`, und „frei definierbare Spalten" hätten keinen Ort, an dem sie stehen könnten. Nicht anfangen, ohne dass jemand es erneut verlangt.

### Stufe 5 — Wissensnetz *(zurückgestellt)*
Interne Verweise `[[…]]`, Rückverweise, verwandte Themen. Spiegelungen: ein Punkt erscheint an mehreren Stellen, ohne kopiert zu werden.

**Vorerst nicht umzusetzen, und keine Zusage.** Der Stufenplan bleibt hier als Absichtserklärung stehen, nicht als Auftrag. Nicht anfangen, ohne dass jemand es erneut verlangt.

Zur Einordnung, falls die Frage wiederkommt: Verweise und Rückverweise wären klein — sie säßen auf demselben Muster wie `#tag`, `@datum` und `!hoch`. „Verwandte Themen" bräuchte zuerst eine Festlegung, was verwandt heißen soll. Spiegelungen wären der große Eingriff: sie brechen die Annahme, dass ein Punkt genau ein `parentId` hat, womit die Identität einer Zeile nicht mehr die `id` wäre, sondern `id` plus Pfad — daran hängen `rowIndex`, `rowEls`, `rowMeta`, `rowPos` und `focusState`.

### Stufe 6 — Dokumente *(fertig)*
Einzelne Bereiche als eigenständige Dokumente behandeln, Import und Export, Archivierung.

**Das Dokument ist der fokussierte Zweig** — kein eigenes Merkmal am Punkt. Der Fokusmodus war bereits das Dokument, ihm fehlte nur der eigene Export: `Datei › Diesen Zweig sichern` schreibt eine vollwertige Sicherung, in der die Zweigwurzel auf `root` umgeschlüsselt ist. Sie lässt sich deshalb wie jede andere Sicherung wieder öffnen.

**Markdown wird eingelesen** und dabei **am Fokus eingefügt, nicht ersetzt**. Eine Datei, die den gesamten Bestand überschreibt, wäre der teuerste Fehler dieser App; die JSON-Öffnung bleibt der einzige Weg, der ersetzt. Der Import läuft in einer Transaktion — ein `Strg+Z` nimmt ihn vollständig zurück. Gelesen wird mindestens die eigene Ausgabe: Einrückung, Notizzeilen und `- [ ]` / `- [x]`.

**Archiviert** wird über das Feld `archiviert`. Ausgeblendet wird an **einer einzigen Stelle**, in `visibleRows()` — weil Gantt, Kalender und Mindmap von dort lesen, gilt es überall, ohne dass eine Ansicht eine eigene Regel bekäme. Wiederzufinden über die Suche `!archiv`; der Untertitel nennt zusätzlich die Zahl des Archivierten, damit ein archivierter Zweig nicht praktisch verschwindet. In der JSON-Sicherung ist Archiviertes enthalten (eine Sicherung muss vollständig sein), in der Markdown-Ausgabe nicht (das ist ein Leseformat).

### Später
KI-Unterstützung für Zusammenfassung und Strukturierung, automatische Projektplanung, Synchronisation zwischen Geräten, Vorlagen, Automatisierungen.

## Gestaltung

Die Oberfläche folgt dem Token-System des zugehörigen Dashboards:

| Rolle | Wert |
|---|---|
| Flächen | `--paper` #f7f5f0, `--sheet` #fffefb, `--raise` #efece4 |
| Linien | `--rule` #e2ded4, `--rule2` #cbc6ba |
| Schrift | `--ink` #1a1a18, `--ink2` #54514b, `--ink3` #87837c |
| Interaktion | `--tinte` #2f3a8c |
| Dringlich | `--signal` #a8321f — reserviert für Überfälliges ab Stufe 3 |
| Erledigt | `--gut` #2b6b46 |

Serif (Iowan Old Style) für Titel, Monospace für Etiketten, Zeiten und Zähler, Sans für Inhalte. Die Oberfläche ist ausdrücklich nur hell; der automatische Dunkelmodus mobiler Browser ist per `color-scheme: only light` abgeschaltet.

Eine Zutat gibt es nur hier: Die senkrechte Führungslinie des Zweigs, in dem der Cursor steht, leuchtet über alle Ebenen mit. In tiefen Strukturen zeigt sie ohne Nachdenken, wo man ist.

## Offene Entscheidungen

- Verhältnis zum Dashboard: eigenständiges Werkzeug oder später ein Modul. Bis dahin bleiben Logik, Darstellung und Speicher getrennt, damit beides möglich ist.
- Speicherform bei größeren Beständen: `localStorage` reicht für einige tausend Punkte, darüber wäre IndexedDB nötig.
- Markdown-Import (bisher nur Ausgabe).
