const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await (await br.newContext({viewport:{width:1000,height:800}})).newPage();
  const knall = []; p.on("pageerror", e => knall.push(String(e)));
  await p.goto(url); await p.waitForSelector(".row");
  pruefe("Start ohne Fehler", knall.length === 0, knall[0]);

  await p.evaluate(() => {
    const n = makeNode("Termin @14.03.2026"); n.parentId = ROOT; nodes[n.id] = n; nodes[ROOT].children.push(n.id);
    window.__id = n.id; merkmaleSpiegeln(n);
    const n2 = makeNode("Zeitraum @01.03.2026..09.03.2026"); n2.parentId = ROOT; nodes[n2.id] = n2; nodes[ROOT].children.push(n2.id);
    window.__id2 = n2.id; merkmaleSpiegeln(n2);
    render(false);
  });
  await p.waitForTimeout(150);
  const id = await p.evaluate(() => window.__id);
  const id2 = await p.evaluate(() => window.__id2);

  console.log("\nA — Symbol nur bei Einzeltermin");
  pruefe("Einzeltermin hat ein Symbol", await p.locator('.row[data-id="'+id+'"] .frist-waehlen').count() === 1);
  pruefe("Zeitraum hat KEIN Symbol", await p.locator('.row[data-id="'+id2+'"] .frist-waehlen').count() === 0);

  console.log("\nB — Öffnen, ohne den Cursor ins Feld zu setzen");
  await p.locator('.row[data-id="'+id+'"] .frist-waehlen').click();
  await p.waitForTimeout(150);
  pruefe("Fenster ist sichtbar", await p.locator("#datumwaehler").isVisible());
  pruefe("Feld wurde NICHT fokussiert", await p.evaluate(id => {
    const el = document.querySelector('.row[data-id="'+id+'"] .text');
    return document.activeElement !== el;
  }, id));
  pruefe("Monat zeigt März", (await p.locator("#dw-titel").textContent()).toLowerCase().indexOf("märz") >= 0,
    await p.locator("#dw-titel").textContent());
  pruefe("der 14. ist markiert", await p.locator(".dwtag.gewaehlt").count() === 1);
  pruefe("sieben Wochentagsnamen", await p.locator("#dw-tage b").count() === 7);

  console.log("\nC — Blättern");
  const titelVor = await p.locator("#dw-titel").textContent();
  await p.click("#dw-vor"); await p.waitForTimeout(80);
  pruefe("weiterblättern ändert den Titel", (await p.locator("#dw-titel").textContent()) !== titelVor);
  await p.click("#dw-zurueck"); await p.waitForTimeout(80);
  pruefe("zurückblättern kommt zurück", (await p.locator("#dw-titel").textContent()) === titelVor);

  console.log("\nD — Tag auswählen schreibt in den Text");
  // Tag 20 im aktuellen (März-)Raster anklicken, nicht "fremd"
  await p.evaluate(() => {
    const eigene = [...document.querySelectorAll(".dwtag")].find(b => b.textContent === "20" && !b.classList.contains("fremd"));
    eigene.click();
  });
  await p.waitForTimeout(200);
  pruefe("Fenster schließt", !(await p.locator("#datumwaehler").isVisible()));
  const textNach = await p.evaluate(id => nodes[id].text, id);
  pruefe("Text zeigt das neue Datum", textNach.indexOf("@20.03.2026") >= 0, textNach);
  pruefe("task.due wurde mitgezogen", await p.evaluate(id => nodes[id].task.due, id) === "2026-03-20");

  console.log("\nE — Rückgängig");
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  const textZurueck = await p.evaluate(id => nodes[id].text, id);
  pruefe("Strg+Z macht die Auswahl rückgängig", textZurueck.indexOf("@14.03.2026") >= 0, textZurueck);

  console.log("\nF — Escape schließt, Esc blockt sonst nichts");
  await p.locator('.row[data-id="'+id+'"] .frist-waehlen').click();
  await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  pruefe("Escape schließt das Fenster", !(await p.locator("#datumwaehler").isVisible()));

  console.log("\nG — Klick außerhalb schließt");
  await p.locator('.row[data-id="'+id+'"] .frist-waehlen').click();
  await p.waitForTimeout(150);
  await p.mouse.click(5, 5);
  await p.waitForTimeout(100);
  pruefe("Klick auf die Überlagerung schließt", !(await p.locator("#datumwaehler").isVisible()));

  console.log("\nH — Tastatur ist blockiert, solange das Fenster offen ist");
  await p.locator('.row[data-id="'+id+'"] .frist-waehlen').click();
  await p.waitForTimeout(150);
  await p.keyboard.press("Control+z"); // sollte NICHT die zuvor gemachte Aenderung nochmal zurücknehmen
  await p.waitForTimeout(150);
  pruefe("Strg+Z wirkte nicht durch das offene Fenster hindurch",
    await p.evaluate(id => nodes[id].text, id) === textZurueck);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);

  pruefe("keine Skriptfehler insgesamt", knall.length === 0, knall.join(" | "));
  await br.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
