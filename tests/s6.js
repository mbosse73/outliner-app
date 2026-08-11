const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await br.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  const knall = []; p.on("pageerror", e => knall.push(String(e)));
  await p.goto(url); await p.waitForSelector(".row");
  pruefe("Start ohne Fehler", knall.length === 0, knall[0]);

  // Testzweig
  await p.evaluate(() => {
    const z = makeNode("Projekt"); z.parentId = ROOT; nodes[z.id] = z; nodes[ROOT].children.push(z.id);
    const mk = (t, eltern, notiz) => { const n = makeNode(t); n.parentId = eltern; if (notiz) n.note = notiz;
      nodes[n.id] = n; nodes[eltern].children.push(n.id); merkmaleSpiegeln(n); return n.id; };
    const a = mk("Erste Aufgabe @2026-09-01..2026-09-05 %30", z.id, "Eine Notiz dazu");
    mk("Unterpunkt", a);
    const b = mk("Zweite Aufgabe", z.id); nodes[b].task = leereAufgabe(); nodes[b].task.status = "erledigt";
    mk("Dritte", z.id);
    window.__z = z.id;
    save(); render(false);
  });
  const zid = await p.evaluate(() => window.__z);

  console.log("\nA — Zweig einzeln sichern");
  await p.evaluate(id => zoomTo(id), zid);
  await p.waitForTimeout(150);
  await p.click("#btn-file"); await p.waitForTimeout(80);
  pruefe("Zweigeintraege erscheinen im Fokus",
    await p.locator('[data-act="zweig-json"]').isVisible());
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-act="zweig-json"]')]);
  const roh = fs.readFileSync(await dl.path(), "utf8");
  const daten = JSON.parse(roh);
  pruefe("Datei heisst nach dem Zweig", (await dl.suggestedFilename()).indexOf("projekt") === 0,
    await dl.suggestedFilename());
  pruefe("Zweigwurzel liegt unter root", daten.nodes.root && daten.nodes.root.text === "Projekt");
  pruefe("nur der Zweig ist drin", Object.keys(daten.nodes).length === 5,
    Object.keys(daten.nodes).length + " Nodes");
  pruefe("Kinder zeigen auf root",
    daten.nodes.root.children.every(c => daten.nodes[c] && daten.nodes[c].parentId === "root"));
  await p.evaluate(() => zoomTo(ROOT)); await p.waitForTimeout(100);
  await p.click("#btn-file"); await p.waitForTimeout(80);
  pruefe("an der Wurzel sind sie verborgen", !(await p.locator('[data-act="zweig-json"]').isVisible()));
  await p.keyboard.press("Escape");

  console.log("\nB — Markdown-Rundlauf");
  await p.evaluate(id => zoomTo(id), zid);
  await p.waitForTimeout(120);
  const [dlmd] = await Promise.all([
    p.waitForEvent("download"),
    (async () => { await p.click("#btn-file"); await p.click('[data-act="zweig-md"]'); })()
  ]);
  const md = fs.readFileSync(await dlmd.path(), "utf8");
  pruefe("Markdown enthaelt Struktur", md.indexOf("- [ ] Erste Aufgabe") >= 0 && md.indexOf("  - Unterpunkt") >= 0, JSON.stringify(md.slice(0,120)));
  pruefe("Notiz ist mit drin", md.indexOf("Eine Notiz dazu") >= 0);
  pruefe("Aufgabenzustand ist mit drin", md.indexOf("- [x] Zweite Aufgabe") >= 0);

  // in einen frischen Zweig einlesen
  const vorher = await p.evaluate(() => Object.keys(nodes).length);
  await p.evaluate(m => {
    const ziel = makeNode("Import"); ziel.parentId = ROOT; nodes[ziel.id] = ziel; nodes[ROOT].children.push(ziel.id);
    window.__i = ziel.id; zoomTo(ziel.id);
    markdownEinfuegen(m);
  }, md);
  await p.waitForTimeout(200);
  const gelesen = await p.evaluate(id => {
    const zaehl = i => 1 + nodes[i].children.reduce((s,c) => s + zaehl(c), 0);
    const k = nodes[id].children.map(c => nodes[c]);
    return { anzahl: zaehl(id) - 1, ersterText: k[0] ? k[0].text : null,
             ersteNotiz: k[0] ? k[0].note : null,
             kindKind: k[0] && k[0].children.length ? nodes[k[0].children[0]].text : null,
             zweitErledigt: k[1] && k[1].task ? k[1].task.status : null,
             ersteFrist: k[0] && k[0].task ? k[0].task.due : null };
  }, await p.evaluate(() => window.__i));
  pruefe("gleiche Anzahl Punkte", gelesen.anzahl === 4, JSON.stringify(gelesen));
  pruefe("Text erhalten", gelesen.ersterText.indexOf("Erste Aufgabe") === 0);
  pruefe("Notiz erhalten", gelesen.ersteNotiz === "Eine Notiz dazu", String(gelesen.ersteNotiz));
  pruefe("Verschachtelung erhalten", gelesen.kindKind === "Unterpunkt", String(gelesen.kindKind));
  pruefe("Aufgabenzustand erhalten", gelesen.zweitErledigt === "erledigt", String(gelesen.zweitErledigt));
  pruefe("Merkmale gespiegelt", gelesen.ersteFrist === "2026-09-05", String(gelesen.ersteFrist));

  console.log("\nC — Import ist rückgängig zu machen");
  await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
  const nach = await p.evaluate(() => {
    let n = 0; const geh = id => { n++; for (const c of nodes[id].children) geh(c); }; geh("root");
    return { gesamt: Object.keys(nodes).length, erreichbar: n };
  });
  pruefe("ein Strg+Z nimmt alles zurueck", nach.gesamt === vorher + 1, vorher + 1 + " → " + nach.gesamt);
  pruefe("keine Waise", nach.gesamt === nach.erreichbar, JSON.stringify(nach));

  console.log("\nD — Archiv blendet überall aus");
  await p.evaluate(id => { zoomTo(ROOT); archivUmschalten(id); }, zid);
  await p.waitForTimeout(200);
  pruefe("weg aus der Gliederung", await p.evaluate(id => !rowIndex.some(r => r.id === id), zid));
  for (const [a, sel] of [["gantt",".gname"],["kalender",".kein"],["mindmap",".mast"]]){
    await p.evaluate(x => setzeAnsicht(x), a);
    await p.waitForTimeout(200);
    pruefe("weg im " + a, await p.evaluate(() =>
      ![...document.querySelectorAll(".gname,.kein,.mast")].some(e => e.textContent.indexOf("Erste Aufgabe") === 0)));
  }
  await p.evaluate(() => setzeAnsicht("gliederung")); await p.waitForTimeout(150);

  console.log("\nE — Archiv ist wiederzufinden");
  pruefe("Untertitel nennt die Zahl",
    (await p.locator("#subtitle").textContent()).indexOf("archiviert") > 0,
    await p.locator("#subtitle").textContent());
  await p.fill("#suche", "!archiv"); await p.waitForTimeout(200);
  pruefe("!archiv zeigt es", await p.evaluate(id => rowIndex.some(r => r.id === id), zid));
  pruefe("und zeichnet es gedaempft", await p.locator(".row.archiviert").count() > 0);
  await p.fill("#suche", ""); await p.waitForTimeout(150);
  // Cursor aus dem Suchfeld holen: dort schluckt der Tastaturzweig Strg+Z, zu Recht
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
  pruefe("Strg+Z holt es zurueck", await p.evaluate(id => !nodes[id].archiviert, zid));

  console.log("\nF — Archiviertes in den Ausgaben");
  await p.evaluate(id => archivUmschalten(id), zid); await p.waitForTimeout(200);
  const [dj] = await Promise.all([p.waitForEvent("download"),
    (async () => { await p.click("#btn-file"); await p.click('[data-act="json"]'); })()]);
  const js = JSON.parse(fs.readFileSync(await dj.path(), "utf8"));
  pruefe("JSON nimmt Archiviertes mit", !!js.nodes[zid] && js.nodes[zid].archiviert === true);
  const [dm] = await Promise.all([p.waitForEvent("download"),
    (async () => { await p.click("#btn-file"); await p.click('[data-act="md"]'); })()]);
  const mdall = fs.readFileSync(await dm.path(), "utf8");
  pruefe("Markdown laesst es weg", mdall.indexOf("Erste Aufgabe") === -1);

  console.log("\nG — Alte Sicherung ohne archiviert");
  const c2 = await br.newContext();
  await c2.addInitScript(() => localStorage.setItem("outliner.v1", JSON.stringify({ v:1, zoomId:"root", nodes:{
    root:{id:"root",parentId:null,children:["a1"],text:"Alt",note:null,collapsed:false,tags:[],created:1,modified:1},
    a1:{id:"a1",parentId:"root",children:[],text:"Alter Punkt",note:null,collapsed:false,tags:[],created:1,modified:1}}})));
  const p2 = await c2.newPage(); p2.on("pageerror", e => knall.push("alt: "+e));
  await p2.goto(url); await p2.waitForSelector(".row");
  pruefe("wird gelesen und normalisiert",
    await p2.evaluate(() => nodes.a1.archiviert === false && rowIndex.length === 1));
  await c2.close();

  pruefe("keine Skriptfehler insgesamt", knall.length === 0, knall.join(" | "));
  await br.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
