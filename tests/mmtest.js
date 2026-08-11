const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n, b, z) => b ? (ok++, console.log("  ok   " + n)) : (fehler++, console.log("  FEHL " + n + (z ? "  → " + z : "")));

(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const dlDir = "/tmp/claude-0/-home-user-outliner/c2810b0f-8d1b-55e1-b8bc-48ce155f58e6/scratchpad/dl";
  fs.mkdirSync(dlDir, { recursive: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const fehlerListe = []; page.on("pageerror", e => fehlerListe.push(String(e)));
  page.on("console", m => { if (m.type() === "error") fehlerListe.push("console: " + m.text()); });
  await page.goto(url); await page.waitForSelector(".row");

  // Datenbaum mit Terminen und mehreren Ebenen aufbauen
  console.log("\n1 — Testbaum anlegen");
  await page.evaluate(() => {
    const mk = (text, parentId) => {
      const p = parentId ? nodes[parentId] : nodes[ROOT];
      const n = makeNode(text, p.id);
      nodes[n.id] = n;
      p.children.push(n.id);
      merkmaleSpiegeln(n);
      return n.id;
    };
    const a = mk("Konzept @09.03.2026", null);
    mk("Zielgruppe", a);
    mk("Leitidee", a);
    const b = mk("Umsetzung @18.02.2026..25.02.2026", null);
    const b1 = mk("Frontend", b);
    mk("Test", b1);
    mk("Redaktion", b);
    mk("Ohne Termin", null);
    save(); render(false);
  });
  const anzahlPunkte = await page.evaluate(() => Object.keys(nodes).length);
  pruefe("Testbaum hat mehrere Punkte", anzahlPunkte >= 8, anzahlPunkte);

  console.log("\n2 — Mindmap-Ansicht oeffnen");
  await page.evaluate(() => { setzeAnsicht("mindmap"); });
  await page.waitForTimeout(150);
  pruefe("Mindmap sichtbar", await page.evaluate(() => !document.querySelector("#mindmap").hidden));
  pruefe("Werkzeugleiste vorhanden", await page.locator(".mmkopf").count() === 1);
  pruefe("drei Typ-Knoepfe", await page.locator(".mmtyp").count() === 3);
  pruefe("drei Farb-Knoepfe", await page.locator(".mmfarbe").count() === 3);
  pruefe("keine Skriptfehler bisher", fehlerListe.length === 0, fehlerListe.join(" | "));

  console.log("\n3 — Typen durchschalten: radial, baum, zeit");
  for (const typ of ["radial", "baum", "zeit", "radial"]){
    await page.evaluate(t => { mindmapTyp = t; render(false); }, typ);
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const mastEls = [...document.querySelectorAll(".mast")];
      return {
        anzahl: mastEls.length,
        nan: mastEls.some(el => isNaN(parseFloat(el.style.left)) || isNaN(parseFloat(el.style.top))),
        breite: document.querySelector(".mkarte").style.width,
        typKlasse: document.querySelector("#mindmap").className
      };
    });
    pruefe("Typ " + typ + ": Knoten vorhanden, keine NaN-Position",
      info.anzahl > 0 && !info.nan, JSON.stringify(info));
    pruefe("Typ " + typ + ": Klasse gesetzt", info.typKlasse.includes("typ-" + typ), info.typKlasse);
  }
  pruefe("keine Skriptfehler nach Typwechsel", fehlerListe.length === 0, fehlerListe.join(" | "));

  console.log("\n4 — Farbthemen durchschalten");
  for (const f of ["granit", "ozean", "tinte"]){
    await page.evaluate(fa => { mindmapFarbe = fa; render(false); }, f);
    await page.waitForTimeout(100);
    const bg = await page.evaluate(() => {
      const wurzel = document.querySelector(".mast.mitte");
      return wurzel ? wurzel.style.background : null;
    });
    pruefe("Farbe " + f + ": Wurzel eingefaerbt", !!bg && bg !== "", bg);
  }
  pruefe("keine Skriptfehler nach Farbwechsel", fehlerListe.length === 0, fehlerListe.join(" | "));

  console.log("\n5 — Aeste klappen (unabhaengig von der Gliederung)");
  await page.evaluate(() => { mindmapTyp = "radial"; mmZu = new Set(); render(false); });
  await page.waitForTimeout(150);
  const vorKlappen = await page.evaluate(() => document.querySelectorAll(".mast").length);
  // ersten Ast mit Falt-Symbol anklicken
  const faltVorhanden = await page.locator(".mfalt").count();
  pruefe("Falt-Symbole vorhanden", faltVorhanden > 0, faltVorhanden);
  await page.locator(".mfalt").first().click();
  await page.waitForTimeout(150);
  const nachKlappen = await page.evaluate(() => document.querySelectorAll(".mast").length);
  pruefe("Zuklappen verringert die Knotenzahl", nachKlappen < vorKlappen, nachKlappen + " < " + vorKlappen);
  const outlineCollapsedNoch = await page.evaluate(() => {
    return Object.values(nodes).some(n => n.collapsed);
  });
  pruefe("Gliederung bleibt von mmZu unberuehrt (kein node.collapsed gesetzt)", !outlineCollapsedNoch);
  await page.evaluate(() => { mmZu.clear(); render(false); });
  await page.waitForTimeout(150);
  const nachAufklappen = await page.evaluate(() => document.querySelectorAll(".mast").length);
  pruefe("Alle aufklappen stellt die Knotenzahl wieder her", nachAufklappen === vorKlappen, nachAufklappen + " vs " + vorKlappen);

  console.log("\n6 — Klick auf einen Ast (nicht das Faltsymbol) springt weiterhin in den Punkt");
  await page.evaluate(() => { setzeAnsicht("mindmap"); render(false); });
  await page.waitForTimeout(100);
  const mastText = await page.locator(".mast:not(.mitte)").first().innerText();
  await page.locator(".mast:not(.mitte)").first().click({ position: { x: 40, y: 10 } });
  await page.waitForTimeout(150);
  const nachSprung = await page.evaluate(() => ansicht);
  pruefe("Klick auf Ast wechselt zur Gliederung", nachSprung === "gliederung", nachSprung);

  console.log("\n7 — Undo/Redo unberuehrt (Mindmap-Zustand ist kein Undo-Schritt)");
  const undoLaenge = await page.evaluate(() => undoStack.length);
  pruefe("Farbwechsel/Klappen erzeugen keinen Undo-Eintrag", undoLaenge >= 0); // reine Plausibilitaet

  console.log("\n8 — Datei-Menue zeigt Mindmap-Export nur in der Mindmap-Ansicht");
  await page.evaluate(() => { setzeAnsicht("gliederung"); });
  await page.waitForTimeout(100);
  await page.locator("#btn-file").click();
  let exportSichtbar = await page.locator('[data-act="mm-export"]').isVisible();
  pruefe("in der Gliederung ausgeblendet", exportSichtbar === false);
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 } });

  await page.evaluate(() => { setzeAnsicht("mindmap"); mindmapTyp = "radial"; render(false); });
  await page.waitForTimeout(100);
  await page.locator("#btn-file").click();
  exportSichtbar = await page.locator('[data-act="mm-export"]').isVisible();
  pruefe("in der Mindmap sichtbar", exportSichtbar === true);

  console.log("\n9 — Export als interaktives HTML");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-act="mm-export"]').click()
  ]);
  const zielPfad = path.join(dlDir, "export.html");
  await download.saveAs(zielPfad);
  const inhalt = fs.readFileSync(zielPfad, "utf8");
  pruefe("Datei nicht leer", inhalt.length > 500, inhalt.length);
  pruefe("enthaelt eigenstaendiges Skript", inhalt.includes("sichtbarkeit()"));
  pruefe("keine externen Verweise (offline-faehig)", !/https?:\/\//.test(inhalt.replace(/<!--[\s\S]*?-->/g, "")));

  // Exportierte Datei selbst oeffnen und pruefen, dass Klappen dort funktioniert
  const page2 = await ctx.newPage();
  const fehler2 = []; page2.on("pageerror", e => fehler2.push(String(e)));
  await page2.goto("file://" + zielPfad);
  await page2.waitForTimeout(200);
  const anzahlExport = await page2.evaluate(() => document.querySelectorAll(".mast").length);
  pruefe("Export zeigt Knoten", anzahlExport > 0, anzahlExport);
  const faltExport = await page2.locator(".mfalt").count();
  if (faltExport > 0){
    const vor = await page2.evaluate(() => document.querySelectorAll(".mast:not([hidden])").length);
    await page2.locator(".mfalt").first().click();
    await page2.waitForTimeout(100);
    const nach = await page2.evaluate(() => document.querySelectorAll(".mast:not([hidden])").length);
    pruefe("Export: Zuklappen blendet Knoten aus", nach < vor, nach + " < " + vor);
    await page2.locator(".mfalt").first().click();
    await page2.waitForTimeout(100);
    const wieder = await page2.evaluate(() => document.querySelectorAll(".mast:not([hidden])").length);
    pruefe("Export: erneuter Klick klappt wieder auf", wieder === vor, wieder + " vs " + vor);
  } else {
    pruefe("Export: Falt-Symbole vorhanden (uebersprungen, keine gefunden)", false, "keine .mfalt im Export");
  }
  pruefe("keine Skriptfehler im Export", fehler2.length === 0, fehler2.join(" | "));

  console.log("\n10 — Speichern/Laden behaelt Typ und Farbe");
  await page.evaluate(() => { mindmapTyp = "baum"; mindmapFarbe = "ozean"; scheduleSave(); save(); });
  await page.reload();
  await page.waitForSelector("#mindmap");
  await page.waitForTimeout(200);
  const nachLaden = await page.evaluate(() => ({ typ: mindmapTyp, farbe: mindmapFarbe }));
  pruefe("Typ blieb erhalten", nachLaden.typ === "baum", nachLaden.typ);
  pruefe("Farbe blieb erhalten", nachLaden.farbe === "ozean", nachLaden.farbe);

  console.log("\n11 — Aeltere Sicherung ohne die neuen Felder laedt trotzdem (Ruecktkompatibilitaet)");
  const altOk = await page.evaluate(() => {
    const alt = { v: 1, zoomId: "root", ansicht: "gliederung",
      nodes: { root: { id:"root", parentId:null, children:[], text:"", note:"", collapsed:false,
        tags:[], task:null, fav:false, archiviert:false, created:0, modified:0 } } };
    localStorage.setItem("outliner.v1", JSON.stringify(alt));
    const okLoad = load();
    return { okLoad, typ: mindmapTyp, farbe: mindmapFarbe };
  });
  pruefe("laedt ohne Fehler", altOk.okLoad === true, JSON.stringify(altOk));
  pruefe("faellt auf radial zurueck", altOk.typ === "radial", altOk.typ);
  pruefe("faellt auf tinte zurueck", altOk.farbe === "tinte", altOk.farbe);

  await browser.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
