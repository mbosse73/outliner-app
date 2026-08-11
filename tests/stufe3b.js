// Prioritaet, Zeitraum, Fortschritt, Sicht "Wichtig"
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n, b, z) => b ? (ok++, console.log("  ok   " + n)) : (fehler++, console.log("  FEHL " + n + (z ? "  → " + z : "")));

(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await (await browser.newContext()).newPage();
  const knall = []; page.on("pageerror", e => knall.push(String(e)));
  await page.goto(url); await page.waitForSelector(".row");

  console.log("\nA — Prioritaet tippen");
  const zeile = page.locator(".row").last();
  await zeile.locator(".text").click();
  await page.keyboard.type("Vertrag prüfen !hoch");
  await page.locator("#title").click(); await page.waitForTimeout(120);
  const id = await zeile.getAttribute("data-id");
  pruefe("task.prio steht auf hoch", await page.evaluate(i => nodes[i].task.prio === "hoch", id));
  pruefe("wird als .prio-hoch ausgezeichnet",
    await zeile.locator(".text").evaluate(el => el.innerHTML.indexOf("prio-hoch") >= 0));
  const gew = await zeile.locator(".prio").evaluate(el => getComputedStyle(el).fontWeight);
  pruefe("hoch traegt mehr Gewicht", Number(gew) >= 700, gew);
  const farbe = await zeile.locator(".prio").evaluate(el => getComputedStyle(el).color);
  pruefe("und benutzt NICHT --signal (das gehoert dem Ueberfaelligen)",
    farbe !== "rgb(168, 50, 31)", farbe);

  console.log("\nB — Prioritaet ueber die Palette");
  await zeile.locator(".text").click();
  await page.keyboard.press("Control+k"); await page.waitForTimeout(80);
  await page.fill("#pal-eingabe", "Priorität niedrig"); await page.waitForTimeout(80);
  await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  const nachher = await page.evaluate(i => ({ text: nodes[i].text, prio: nodes[i].task.prio }), id);
  pruefe("die Palette schreibt ins Textfeld, nicht am Modell vorbei",
    nachher.text.indexOf("!niedrig") >= 0 && nachher.text.indexOf("!hoch") === -1,
    nachher.text);
  pruefe("Modell folgt dem Text", nachher.prio === "niedrig");
  await page.keyboard.press("Control+z"); await page.waitForTimeout(100);
  pruefe("Strg+Z nimmt den Palettenbefehl zurueck",
    await page.evaluate(i => nodes[i].task.prio === "hoch", id));

  console.log("\nC — Zeitraum");
  const z2 = page.locator(".row").last();
  await z2.locator(".text").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Umzug @2026-09-01..2026-09-14");
  await page.locator("#title").click(); await page.waitForTimeout(120);
  const spanne = await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.text.indexOf("Umzug") === 0);
    return n && n.task ? { start: n.task.start, due: n.task.due } : null;
  });
  pruefe("Start und Frist getrennt gesetzt",
    spanne && spanne.start === "2026-09-01" && spanne.due === "2026-09-14", JSON.stringify(spanne));
  pruefe("ein einzelnes Datum setzt nur die Frist",
    await page.evaluate(() => {
      const n = Object.values(nodes).find(x => x.task && x.task.due && !x.task.start);
      return !!n;
    }));

  console.log("\nD — Fortschritt");
  await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.text.indexOf("Umzug") === 0);
    n.text = "Umzug @2026-09-01..2026-09-14 %100";
    merkmaleSpiegeln(n); render(false);
  });
  pruefe("%100 landet im Modell", await page.evaluate(() =>
    Object.values(nodes).find(x => x.text.indexOf("Umzug") === 0).task.progress === 100));
  pruefe("100% wird als voll ausgezeichnet", await page.locator(".fortschritt-voll").count() === 1);
  pruefe("Prozent in Prosa wird nicht gegriffen", await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.text.indexOf("Umzug") === 0);
    n.text = "Umzug, 50% der Kisten sind gepackt"; merkmaleSpiegeln(n);
    return n.task.progress === null;
  }));

  console.log("\nE — Sicht Wichtig");
  await page.fill("#suche", "!wichtig"); await page.waitForTimeout(100);
  const sichtbar = await page.locator(".row.treffer").count();
  const soll = await page.evaluate(() => Object.entries(nodes)
    .filter(([i,n]) => i !== "root" && n.task && n.task.status !== "erledigt" && n.task.prio === "hoch").length);
  pruefe("!wichtig zeigt offenes mit hoher Prioritaet", sichtbar === soll && soll > 0,
    "sichtbar " + sichtbar + ", soll " + soll);
  await page.fill("#suche", "!niedrig"); await page.waitForTimeout(100);
  pruefe("!niedrig filtert nach Stufe", await page.locator(".row.treffer").count() ===
    await page.evaluate(() => Object.entries(nodes).filter(([i,n]) => i !== "root" && n.task && n.task.prio === "niedrig").length));
  await page.fill("#suche", ""); await page.waitForTimeout(80);

  console.log("\nF — Notiz bleibt Prosa");
  pruefe("weder Prioritaet noch Prozent in der Notiz", await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.note && (x.note.indexOf("!") >= 0 || x.note.indexOf("%") >= 0));
    if (!n) return true;
    const el = document.querySelector('.row[data-id="' + n.id + '"] .note');
    return el.innerHTML.indexOf("prio") === -1 && el.innerHTML.indexOf("fortschritt") === -1;
  }));

  pruefe("keine Skriptfehler", knall.length === 0, knall[0]);
  await browser.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
