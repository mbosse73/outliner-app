const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await (await browser.newContext({viewport:{width:1100,height:800}})).newPage();
  const knall = []; page.on("pageerror", e => knall.push(String(e)));
  await page.goto(url); await page.waitForSelector(".row");
  pruefe("Start ohne Fehler", knall.length === 0, knall[0]);

  // Testdaten mit Zeitraum, Frist und Zusammenfassung
  await page.evaluate(() => {
    const p = makeNode("Umzug"); p.parentId = ROOT; nodes[p.id] = p; nodes[ROOT].children.push(p.id);
    const mk = (t, txt) => { const n = makeNode(txt); n.parentId = p.id; nodes[n.id] = n; p.children.push(n.id); merkmaleSpiegeln(n); return n; };
    mk(0, "Kisten packen @2026-09-01..2026-09-10 %40");
    mk(0, "Schlüssel abgeben @2026-09-14");
    mk(0, "Nachsendeauftrag @2020-01-05");
    window.__p = p.id;
    save(); render(false);
  });

  console.log("\nA — Umschalten");
  await page.click('.sicht[data-sicht="gantt"]'); await page.waitForTimeout(200);
  pruefe("Gantt ist sichtbar", await page.locator("#gantt").isVisible());
  pruefe("Gliederung ist weg", !(await page.locator("#rows").isVisible()));
  pruefe("Schaltflaeche ist markiert", await page.locator('.sicht[data-sicht="gantt"].an').count() === 1);

  console.log("\nB — Raute gegen Balken");
  pruefe("Zeitraum wird zum Balken", await page.locator(".gbalken:not(.summe)").count() >= 1);
  pruefe("Frist ohne Anfang wird zur Raute", await page.locator(".graute").count() >= 2);
  pruefe("Elternpunkt fasst zusammen", await page.locator(".gbalken.summe").count() >= 1);
  const summe = await page.evaluate(id => {
    const r = spannenRechner(); const s = r(id); return s;
  }, await page.evaluate(() => window.__p));
  pruefe("Zusammenfassung spannt ueber alle Kinder",
    summe && summe.von === "2020-01-05" && summe.bis === "2026-09-14" && summe.eigen === false,
    JSON.stringify(summe));

  console.log("\nC — Farben nach Rolle");
  const rot = await page.locator(".graute.ueberfaellig").first().evaluate(el => getComputedStyle(el).backgroundColor);
  pruefe("Ueberfaelliges in --signal", rot === "rgb(168, 50, 31)", rot);

  console.log("\nD — Zusammenfassung auch zugeklappt");
  await page.evaluate(id => { nodes[id].collapsed = true; render(false); }, await page.evaluate(() => window.__p));
  await page.waitForTimeout(150);
  pruefe("zugeklapptes Projekt behaelt seinen Balken", await page.locator(".gbalken.summe").count() >= 1);
  await page.evaluate(id => { nodes[id].collapsed = false; render(false); }, await page.evaluate(() => window.__p));

  console.log("\nE — Projektion, kein zweiter Bestand");
  pruefe("Undatiertes laeuft nicht leer mit",
    await page.locator(".gzeile").count() < await page.evaluate(() => rowIndex.length),
    await page.locator(".gzeile").count() + " von " + await page.evaluate(() => rowIndex.length));
  await page.fill("#suche", "Kisten"); await page.waitForTimeout(200);
  const nZ = await page.locator(".gzeile").count();
  const nR = await page.evaluate(() => {
    const s = spannenRechner();
    return rowIndex.filter(r => s(r.id)).length;
  });
  pruefe("Gantt zeigt genau die gefilterten datierten Zeilen", nZ === nR && nZ > 0, nZ + " / " + nR);
  await page.fill("#suche", ""); await page.waitForTimeout(150);

  console.log("\nF — Mindmap");
  await page.click('.sicht[data-sicht="mindmap"]'); await page.waitForTimeout(250);
  pruefe("Mindmap ist sichtbar", await page.locator("#mindmap").isVisible());
  const aeste = await page.locator(".mast").count();
  pruefe("ein Knoten je sichtbarer Zeile plus Mitte",
    aeste === nR + 1 || aeste === (await page.evaluate(() => rowIndex.length)) + 1, "maste: " + aeste);
  pruefe("Verbindungen als SVG-Pfade", await page.locator("#mindmap svg path").count() > 0);
  pruefe("genau eine Mitte", await page.locator(".mast.mitte").count() === 1);

  console.log("\nG — Klick springt hinein");
  const ziel = await page.locator(".mast:not(.mitte)").first();
  await ziel.click(); await page.waitForTimeout(200);
  pruefe("zurueck in der Gliederung", await page.evaluate(() => ansicht === "gliederung"));
  pruefe("Fokus sitzt auf dem Punkt", await page.evaluate(() => zoomId !== "root"));

  console.log("\nH — Undo aus einer anderen Ansicht");
  await page.evaluate(() => { zoomTo("root"); setzeAnsicht("gantt"); });
  await page.waitForTimeout(150);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(150);
  pruefe("Strg+Z im Gantt wirft nicht", knall.length === 0, knall.join(" | "));

  console.log("\nI — Ansicht ueberlebt das Neuladen");
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForSelector(".gantt");
  pruefe("wieder im Gantt", await page.evaluate(() => ansicht === "gantt"));

  console.log("\nJ — Alte Sicherung ohne ansicht");
  const c2 = await browser.newContext();
  await c2.addInitScript(() => localStorage.setItem("outliner.v1", JSON.stringify({ v:1, zoomId:"root", nodes:{
    root:{id:"root",parentId:null,children:["a1"],text:"Alt",note:null,collapsed:false,tags:[],created:1,modified:1},
    a1:{id:"a1",parentId:"root",children:[],text:"Alter Punkt",note:null,collapsed:false,tags:[],created:1,modified:1}}})));
  const p2 = await c2.newPage(); p2.on("pageerror", e => knall.push("alt: "+e));
  await p2.goto(url); await p2.waitForSelector(".row");
  pruefe("landet auf der Gliederung", await p2.evaluate(() => ansicht === "gliederung"));
  await c2.close();

  pruefe("keine Skriptfehler insgesamt", knall.length === 0, knall.join(" | "));
  await browser.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
