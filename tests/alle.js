// Fuehrt alle Pruefsuiten in diesem Ordner nacheinander aus und fasst das
// Ergebnis zusammen. Jede Suite startet ihren eigenen kurzlebigen Server und
// Browser — deshalb sequentiell, nicht parallel, damit Ports und
// Fehlermeldungen nicht durcheinanderlaufen.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const NUR = process.argv[2] || null; // optional: ein einzelner Dateiname zum gezielten Nachpruefen

const dateien = fs.readdirSync(__dirname)
  .filter(f => f.endsWith(".js") && f !== "alle.js" && f !== path.basename(__filename))
  .filter(f => !NUR || f === NUR)
  .sort();

if (!dateien.length){
  console.log("Keine Pruefdatei gefunden" + (NUR ? " (" + NUR + ")" : "") + ".");
  process.exit(1);
}

let gesamtOk = 0, gesamtFehler = 0, gescheiterteSuiten = [];

for (const datei of dateien){
  console.log("\n" + "=".repeat(60));
  console.log(datei);
  console.log("=".repeat(60));
  const res = spawnSync(process.execPath, [path.join(__dirname, datei)], { stdio: "inherit" });
  if (res.status !== 0){
    gescheiterteSuiten.push(datei);
    gesamtFehler++;
  } else {
    gesamtOk++;
  }
}

console.log("\n" + "=".repeat(60));
console.log(gesamtOk + " Suiten grün, " + gesamtFehler + " mit Fehlern"
  + (gescheiterteSuiten.length ? " (" + gescheiterteSuiten.join(", ") + ")" : ""));
process.exit(gesamtFehler ? 1 : 0);
