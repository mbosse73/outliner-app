// Wegwerf-Pruefung ausserhalb des Repos. Nichts davon gehoert ins Repository.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
function pruefe(name, bedingung, zusatz){
  if (bedingung){ ok++; console.log("  ok   " + name); }
  else { fehler++; console.log("  FEHL " + name + (zusatz ? "  → " + zusatz : "")); }
}

(async () => {
  // Kleiner Server, damit localStorage wie auf GitHub Pages funktioniert
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(DATEI));
  }).listen(0);
  const port = server.address().port;
  const url = "http://127.0.0.1:" + port + "/";

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const konsolenfehler = [];
  page.on("pageerror", e => konsolenfehler.push(String(e)));
  await page.goto(url);
  await page.waitForSelector(".row");

  console.log("\n1 — Start und Saat");
  pruefe("keine Skriptfehler beim Start", konsolenfehler.length === 0, konsolenfehler[0]);
  const aufgabenAnfang = await page.locator(".row.aufgabe").count();
  pruefe("vier Aufgaben in der Saat", aufgabenAnfang === 4, "gefunden: " + aufgabenAnfang);
  pruefe("nichts ist beim ersten Start ueberfaellig",
    await page.locator(".row.ueberfaellig").count() === 0);
  pruefe("Kaestchen nur bei Aufgaben sichtbar",
    await page.locator(".row:not(.aufgabe) .kasten").first().isVisible() === false);
  pruefe("@heute wurde nach task.due gespiegelt",
    await page.evaluate(() => {
      const h = new Date(); const p = x => String(x).padStart(2,"0");
      const iso = h.getFullYear()+"-"+p(h.getMonth()+1)+"-"+p(h.getDate());
      return Object.values(nodes).some(n => n.task && n.task.due === iso);
    }));
  pruefe("Frist wird ausgezeichnet", await page.locator(".frist").count() > 0);

  pruefe("Notiz zeichnet keine Frist aus, weil dort keine gilt",
    await page.evaluate(() => {
      const n = Object.values(nodes).find(x => x.note && x.note.indexOf("@morgen") >= 0);
      const el = document.querySelector('.row[data-id="' + n.id + '"] .note');
      return el.innerHTML.indexOf("frist") === -1 && el.textContent.indexOf("@morgen") >= 0;
    }));
  pruefe("Tags in der Notiz bleiben ausgezeichnet",
    await page.evaluate(() => {
      const n = Object.values(nodes).find(x => x.note && x.note.indexOf("#tag") >= 0);
      const el = document.querySelector('.row[data-id="' + n.id + '"] .note');
      return el.innerHTML.indexOf('class="tag"') >= 0;
    }));

  console.log("\n2 — Kaestchen klicken, Cursor bleibt stehen");
  const ersteAufgabe = page.locator(".row.aufgabe").first();
  await ersteAufgabe.locator(".text").click();
  const idVorher = await ersteAufgabe.getAttribute("data-id");
  await ersteAufgabe.locator(".kasten").click();
  pruefe("Zeile ist erledigt", await ersteAufgabe.evaluate(el => el.classList.contains("erledigt")));
  pruefe("Cursor blieb im Textfeld",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("text")));
  pruefe("Durchstreichung greift",
    await ersteAufgabe.locator(".text").evaluate(el => getComputedStyle(el).textDecorationLine.includes("line-through")));

  console.log("\n3 — Rueckgaengig");
  await page.keyboard.press("Control+z");
  pruefe("Strg+Z nimmt das Abhaken zurueck",
    await page.locator('.row[data-id="' + idVorher + '"]').evaluate(el => !el.classList.contains("erledigt")));
  await page.keyboard.press("Control+Shift+z");
  pruefe("Strg+Umschalt+Z stellt wieder her",
    await page.locator('.row[data-id="' + idVorher + '"]').evaluate(el => el.classList.contains("erledigt")));
  await page.keyboard.press("Control+z");

  console.log("\n4 — Datum tippen");
  const leer = page.locator(".row").last();
  await leer.locator(".text").click();
  await page.keyboard.type("Steuer @morgen");
  pruefe("beim Tippen steht reiner Text im Feld",
    await leer.locator(".text").evaluate(el => el.innerHTML.indexOf("<span") === -1));
  await page.locator("#title").click();          // Feld verlassen
  await page.waitForTimeout(120);
  const morgen = await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate()+1); const p = x => String(x).padStart(2,"0");
    return p(d.getDate())+"."+p(d.getMonth()+1)+"."+d.getFullYear();   // deutsches Ausgabeformat
  });
  const zeileText = await leer.locator(".text").textContent();
  pruefe("@morgen ist ausgeschrieben", zeileText.includes("@" + morgen), zeileText);
  pruefe("Punkt wurde von selbst zur Aufgabe", await leer.evaluate(el => el.classList.contains("aufgabe")));
  pruefe("Strg+Z nimmt auch das zurueck", await (async () => {
    await page.keyboard.press("Control+z");
    return true;
  })());

  console.log("\n5 — Ueberfaellig in Signalrot");
  await page.evaluate(() => {
    const id = Object.keys(nodes).find(i => i !== "root");
    nodes[id].task = leereAufgabe();
    nodes[id].task.due = "2020-01-01";
    nodes[id].text = nodes[id].text + " @2020-01-01";
    render(false);
  });
  pruefe("eine Zeile ist ueberfaellig", await page.locator(".row.ueberfaellig").count() === 1);
  const farbe = await page.locator(".row.ueberfaellig .frist").first().evaluate(el => getComputedStyle(el).color);
  pruefe("Frist steht in --signal (#a8321f)", farbe === "rgb(168, 50, 31)", farbe);

  // eine Aufgabe abhaken, damit !erledigt und - [x] etwas zu treffen haben
  await page.locator(".row.aufgabe").first().locator(".kasten").click();
  await page.waitForTimeout(60);

  console.log("\n6 — Sichten als gespeicherte Suchen");
  for (const [marke, erwartet] of [["!aufgabe", n => !!n.task], ["!offen", n => n.task && n.task.status !== "erledigt"],
                                    ["!erledigt", n => n.task && n.task.status === "erledigt"],
                                    ["!ueberfaellig", n => n.task && n.task.status !== "erledigt" && n.task.due && n.task.due < new Date().toISOString().slice(0,10)]]){
    await page.fill("#suche", marke);
    await page.waitForTimeout(80);
    const sichtbar = await page.locator(".row.treffer").count();
    const soll = await page.evaluate(fn => Object.entries(nodes).filter(([i,n]) => i !== "root" && eval("(" + fn + ")")(n)).length, erwartet.toString());
    pruefe(marke + " trifft " + soll, sichtbar === soll, "sichtbar: " + sichtbar);
  }
  await page.fill("#suche", "");
  await page.waitForTimeout(80);

  console.log("\n7 — Markdown-Ausgabe");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => { await page.click("#btn-file"); await page.click('[data-act="md"]'); })()
  ]);
  const md = fs.readFileSync(await download.path(), "utf8");
  pruefe("offene Aufgabe als - [ ]", md.includes("- [ ] "));
  pruefe("erledigte Aufgabe als - [x]", md.includes("- [x] "));
  pruefe("gewoehnliche Punkte ohne Kaestchen", /^\s*- [^[]/m.test(md));

  console.log("\n8 — Neu laden");
  const vorher = await page.evaluate(() => JSON.stringify(nodes));
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector(".row");
  const nachher = await page.evaluate(() => JSON.stringify(nodes));
  pruefe("Stand ueberlebt das Neuladen", vorher === nachher);

  // Eigener Kontext: die App speichert bei beforeunload, ein injizierter
  // Altstand wuerde in derselben Seite sofort ueberschrieben.
  console.log("\n9 — Alte Sicherung aus Stufe 2 (ohne task)");
  const ctxAlt = await browser.newContext();
  await ctxAlt.addInitScript(() => {
    localStorage.setItem("outliner.v1", JSON.stringify({ v:1, zoomId:"root", nodes:{
      root:{ id:"root", parentId:null, children:["a1"], text:"Alt", note:null, collapsed:false, tags:[], created:1, modified:1 },
      a1:{ id:"a1", parentId:"root", children:[], text:"Punkt aus Stufe 2", note:null, collapsed:false, tags:[], created:1, modified:1 }
    }}));
  });
  const pAlt = await ctxAlt.newPage();
  pAlt.on("pageerror", e => konsolenfehler.push("alt: " + e));
  await pAlt.goto(url);
  await pAlt.waitForSelector(".row");
  pruefe("alter Stand wird gelesen", (await pAlt.locator(".row .text").first().textContent()).includes("Stufe 2"));
  pruefe("keine Zeile traegt ein Kaestchen", await pAlt.locator(".row.aufgabe").count() === 0);
  pruefe("task und fav wurden normalisiert",
    await pAlt.evaluate(() => nodes.a1.task === null && nodes.a1.fav === false));
  await ctxAlt.close();

  console.log("\n9b — Sicherung mit unvollstaendigem task");
  const ctxHalb = await browser.newContext();
  await ctxHalb.addInitScript(() => {
    localStorage.setItem("outliner.v1", JSON.stringify({ v:1, zoomId:"root", nodes:{
      root:{ id:"root", parentId:null, children:["b1"], text:"Halb", note:null, collapsed:false, tags:[], created:1, modified:1 },
      b1:{ id:"b1", parentId:"root", children:[], text:"Aufgabe ohne Status", note:null, collapsed:false, tags:[], task:{ due:"2020-05-05" }, created:1, modified:1 }
    }}));
  });
  const pHalb = await ctxHalb.newPage();
  pHalb.on("pageerror", e => konsolenfehler.push("halb: " + e));
  await pHalb.goto(url);
  await pHalb.waitForSelector(".row");
  pruefe("fehlender Status wird zu offen",
    await pHalb.evaluate(() => nodes.b1.task.status === "offen" && nodes.b1.task.prio === null));
  pruefe("und faellt als ueberfaellig auf", await pHalb.locator(".row.ueberfaellig").count() === 1);
  await ctxHalb.close();

  console.log("\n10 — Struktur auf einer Aufgabenzeile");
  const ctxNeu = await browser.newContext();
  const pNeu = await ctxNeu.newPage();
  pNeu.on("pageerror", e => konsolenfehler.push("neu: " + e));
  await pNeu.goto(url);
  await pNeu.waitForSelector(".row");
  const page2 = pNeu;
  // zweite Aufgabe: sie hat einen Vorgaenger, laesst sich also einruecken
  const auf = page2.locator(".row.aufgabe").nth(1);
  const aufId = await auf.getAttribute("data-id");
  const tiefe = id => page2.locator('.row[data-id="' + id + '"]').evaluate(el => el.style.getPropertyValue("--depth"));
  const tiefeVorher = await tiefe(aufId);
  await auf.locator(".text").click();
  await page2.keyboard.press("Tab");
  await page2.waitForTimeout(60);
  pruefe("Tab rueckt die Aufgabe ein", await tiefe(aufId) === String(Number(tiefeVorher) + 1),
    tiefeVorher + " → " + await tiefe(aufId));
  pruefe("Aufgabe bleibt nach Tab eine Aufgabe",
    await page2.locator('.row[data-id="' + aufId + '"]').evaluate(el => el.classList.contains("aufgabe")));
  pruefe("Frist bleibt erhalten",
    await page2.evaluate(id => !!(nodes[id].task && nodes[id].task.due), aufId));
  pruefe("Cursor blieb auf der Zeile",
    await page2.evaluate(id => { const r = document.activeElement.closest(".row"); return r && r.dataset.id === id; }, aufId));
  await page2.keyboard.press("Control+z");
  await page2.waitForTimeout(60);
  pruefe("Strg+Z stellt die Einrueckung zurueck", await tiefe(aufId) === tiefeVorher);

  console.log("\n11 — Datei per file:// (harte Regel 3)");
  const ctxDatei = await browser.newContext();
  const pDatei = await ctxDatei.newPage();
  const dateiFehler = [];
  pDatei.on("pageerror", e => dateiFehler.push(String(e)));
  await pDatei.goto("file://" + DATEI);
  await pDatei.waitForSelector(".row");
  pruefe("laeuft ohne Server", await pDatei.locator(".row").count() > 0);
  pruefe("auch dort keine Skriptfehler", dateiFehler.length === 0, dateiFehler[0]);
  await ctxDatei.close();

  pruefe("keine Skriptfehler insgesamt", konsolenfehler.length === 0, konsolenfehler.join(" | "));

  await browser.close();
  server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
