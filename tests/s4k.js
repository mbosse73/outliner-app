const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
const saat = () => {
  const p = makeNode("Umzug"); p.parentId = ROOT; nodes[p.id] = p; nodes[ROOT].children.push(p.id);
  const mk = txt => { const n = makeNode(txt); n.parentId = p.id; nodes[n.id] = n; p.children.push(n.id); merkmaleSpiegeln(n); return n; };
  mk("Kisten packen @2026-09-01..2026-09-14 %40");
  mk("Nachsendeauftrag @2026-09-03..2026-09-09");
  mk("Schlüsselübergabe @2026-09-14");
  const e = mk("Kaution @2026-09-02"); e.task.status = "erledigt";
  window.__p = p.id; render(false);
};
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await (await browser.newContext({viewport:{width:1200,height:900}})).newPage();
  const knall = []; page.on("pageerror", e => knall.push(String(e)));
  await page.goto(url); await page.waitForSelector(".row");
  await page.evaluate(saat);
  await page.evaluate(() => { setzeAnsicht("kalender"); kalenderTag = "2026-09-10"; render(false); });
  await page.waitForTimeout(250);
  pruefe("Start ohne Fehler", knall.length === 0, knall[0]);

  console.log("\nA — Monatsraster");
  pruefe("Kalender sichtbar", await page.locator("#kalender").isVisible());
  pruefe("Wochenzeilen vorhanden", await page.locator(".kwoche").count() >= 4);
  pruefe("sieben Wochentagsnamen", await page.locator(".kwtage b").count() === 7);
  pruefe("heutiger Tag markiert oder ausserhalb",
    await page.locator(".ktag.heute").count() <= 1);

  console.log("\nB — Zeitraum bricht am Wochenende um");
  const stuecke = await page.evaluate(() => {
    const t = [...document.querySelectorAll(".kein")].filter(b => b.textContent.indexOf("Kisten") === 0);
    return t.map(b => Math.round(parseFloat(b.style.width) / 100 * 7));
  });
  pruefe("Kisten packen ergibt mehrere Stuecke", stuecke.length >= 3, JSON.stringify(stuecke));
  pruefe("zusammen 14 Tage", stuecke.reduce((a,b)=>a+b,0) === 14, JSON.stringify(stuecke));
  pruefe("Fortsetzungen sind offen gezeichnet",
    await page.locator(".kein.offen-l").count() >= 1);

  console.log("\nC — Spuren");
  const spuren = await page.evaluate(() => {
    // in der Woche vom 31.08.: Kisten (ab 01.) und Kaution (02.) und Nachsende (ab 03.)
    const zeile = [...document.querySelectorAll(".kwoche")].find(z =>
      [...z.querySelectorAll(".kein")].some(b => b.textContent.indexOf("Kisten") === 0));
    const b = [...zeile.querySelectorAll(".kein")];
    return b.map(x => ({ t: x.textContent.slice(0,8), top: x.style.top, left: x.style.left }));
  });
  const oben = new Set(spuren.map(s => s.top));
  pruefe("ueberschneidende Eintraege liegen untereinander", oben.size >= 2, JSON.stringify(spuren));

  console.log("\nD — Keine Zusammenfassung");
  pruefe("Elternpunkt ohne eigenes Datum fehlt", await page.evaluate(() =>
    ![...document.querySelectorAll(".kein")].some(b => b.textContent.trim() === "Umzug")));
  pruefe("im Gantt erscheint er dagegen", await page.evaluate(id => {
    setzeAnsicht("gantt");
    const da = [...document.querySelectorAll(".gname")].some(g => g.textContent.trim() === "Umzug");
    setzeAnsicht("kalender"); kalenderTag = "2026-09-10"; render(false);
    return da;
  }, await page.evaluate(() => window.__p)));

  console.log("\nE — Farben nach Rolle");
  await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.text.indexOf("Schlüssel") === 0);
    n.text = "Schlüsselübergabe @2020-03-04"; merkmaleSpiegeln(n);
    kalenderTag = "2020-03-04"; render(false);
  });
  await page.waitForTimeout(200);
  const f = await page.locator(".kein.ueberfaellig").first().evaluate(el => getComputedStyle(el).color);
  pruefe("Ueberfaelliges in --signal", f === "rgb(168, 50, 31)", f);
  await page.evaluate(() => {
    const n = Object.values(nodes).find(x => x.text.indexOf("Schlüssel") === 0);
    n.text = "Schlüsselübergabe @2026-09-14"; merkmaleSpiegeln(n);
    kalenderTag = "2026-09-10"; render(false);
  });

  console.log("\nF — Blättern und Modi");
  const vorher = await page.locator(".kzeitraum").textContent();
  await page.click(".knav .knopf:first-child"); await page.waitForTimeout(150);
  pruefe("‹ blaettert zurueck", (await page.locator(".kzeitraum").textContent()) !== vorher);
  await page.click(".knav .knopf:last-child"); await page.waitForTimeout(150);
  pruefe("› kommt zurueck", (await page.locator(".kzeitraum").textContent()) === vorher);
  for (const m of ["Woche","Tag","Monat"]){
    await page.click(`.kmodus:text-is("${m}")`); await page.waitForTimeout(180);
    pruefe(m + " laesst sich waehlen", await page.evaluate(x => kalenderModus === x, m.toLowerCase()));
  }
  await page.click('.kmodus:text-is("Tag")'); await page.evaluate(() => { kalenderTag = "2026-09-05"; render(false); });
  await page.waitForTimeout(180);
  pruefe("Tagesliste zeigt Laufendes", await page.locator(".kzeile").count() >= 2);
  pruefe("und benennt den Zustand", (await page.locator(".kwann").first().textContent()).length > 0);
  await page.click('.kmodus:text-is("Monat")'); await page.waitForTimeout(150);

  console.log("\nG — Projektion");
  await page.fill("#suche", "Kisten"); await page.waitForTimeout(200);
  pruefe("Suche wirkt im Kalender", await page.evaluate(() =>
    [...document.querySelectorAll(".kein")].every(b => b.textContent.indexOf("Kisten") === 0)));
  await page.fill("#suche", ""); await page.waitForTimeout(150);

  console.log("\nH — Zugeklappt: Termine bleiben, Zeilen nicht");
  const vorZu = await page.locator(".kein").count();
  await page.evaluate(id => { nodes[id].collapsed = true; render(false); }, await page.evaluate(() => window.__p));
  await page.waitForTimeout(200);
  pruefe("Termine ueberstehen das Zuklappen",
    await page.locator(".kein").count() === vorZu, vorZu + " → " + await page.locator(".kein").count());
  pruefe("die Gliederung zeigt die Zeilen dennoch nicht", await page.evaluate(id =>
    !rowIndex.some(r => nodes[r.id].parentId === id), await page.evaluate(() => window.__p)));
  pruefe("im Gantt gilt weiter das Zuklappen", await page.evaluate(id => {
    setzeAnsicht("gantt");
    const kinder = [...document.querySelectorAll(".gname")].filter(g =>
      g.textContent.indexOf("Kisten") === 0).length;
    setzeAnsicht("kalender"); kalenderTag = "2026-09-10"; render(false);
    return kinder === 0;
  }, await page.evaluate(() => window.__p)));

  console.log("\nH2 — Fokus wirkt trotzdem");
  await page.evaluate(id => { zoomTo(id); setzeAnsicht("kalender"); kalenderTag = "2026-09-10"; render(false); },
    await page.evaluate(() => window.__p));
  await page.waitForTimeout(200);
  pruefe("im Fokus nur dessen Termine", await page.evaluate(() =>
    [...document.querySelectorAll(".kein")].length > 0 && zoomId !== "root"));
  await page.evaluate(() => { zoomTo(ROOT); setzeAnsicht("kalender"); kalenderTag = "2026-09-10"; render(false); });
  await page.waitForTimeout(200);

  console.log("\nH3 — Klick springt zum Punkt");
  await page.locator(".kein").first().click(); await page.waitForTimeout(250);
  pruefe("in der Gliederung gelandet", await page.evaluate(() => ansicht === "gliederung"));
  pruefe("Vorfahr wurde aufgeklappt", await page.evaluate(id => !nodes[id].collapsed, await page.evaluate(() => window.__p)));

  console.log("\nI — Neuladen");
  await page.evaluate(() => { setzeAnsicht("kalender"); kalenderModus = "woche"; kalenderTag = "2020-01-06"; save(); });
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForSelector("#kalender");
  pruefe("Modus ueberlebt", await page.evaluate(() => kalenderModus === "woche"));
  pruefe("Anker steht wieder auf heute", await page.evaluate(() => kalenderAnker() === heuteISO()));

  console.log("\nJ — Alte Sicherung");
  const c2 = await browser.newContext();
  await c2.addInitScript(() => localStorage.setItem("outliner.v1", JSON.stringify({ v:1, zoomId:"root", nodes:{
    root:{id:"root",parentId:null,children:["a1"],text:"Alt",note:null,collapsed:false,tags:[],created:1,modified:1},
    a1:{id:"a1",parentId:"root",children:[],text:"Alter Punkt",note:null,collapsed:false,tags:[],created:1,modified:1}}})));
  const p2 = await c2.newPage(); p2.on("pageerror", e => knall.push("alt: "+e));
  await p2.goto(url); await p2.waitForSelector(".row");
  pruefe("ohne kalenderModus → monat", await p2.evaluate(() => kalenderModus === "monat" && ansicht === "gliederung"));
  await c2.close();

  pruefe("keine Skriptfehler insgesamt", knall.length === 0, knall.join(" | "));
  await browser.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
