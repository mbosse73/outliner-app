const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await (await br.newContext()).newPage();
  const knall = []; p.on("pageerror", e => knall.push(String(e)));
  await p.goto(url); await p.waitForSelector(".row");
  pruefe("Start ohne Fehler", knall.length === 0, knall[0]);

  const r = await p.evaluate(() => {
    const out = {};
    out.mitJahr = loeseDatum("09.03.2026");
    out.ohneFuehrendeNull = loeseDatum("9.3.2026");
    out.ungueltig = loeseDatum("31.02.2026");
    out.altesISO = loeseDatum("2026-03-09");
    out.alsDE = alsDE("2026-03-09");

    // Jahr-Inferenz: heutiges Datum fest auf 2026-08-04 (Session-Datum)
    const heuteFix = new Date(2026, 7, 4); heuteFix.setHours(0,0,0,0);
    out.heuteRoh = heuteISO();

    out.wortSchmuecke_normal = FRIST_RE.source; // nur zur Kontrolle
    out.raw_dot_no_year = loeseDatum("9.3.");    // hängt vom echten Systemdatum ab
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  pruefe("TT.MM.JJJJ korrekt geloest", r.mitJahr === "2026-03-09");
  pruefe("ohne fuehrende Null korrekt", r.ohneFuehrendeNull === "2026-03-09");
  pruefe("ungueltiges Datum liefert null", r.ungueltig === null);
  pruefe("alte ISO-Schreibweise wird gelesen", r.altesISO === "2026-03-09");
  pruefe("alsDE formatiert TT.MM.JJJJ", r.alsDE === "09.03.2026");
  pruefe("Systemdatum in dieser Sandbox", true, r.heuteRoh);
  pruefe("9.3. ohne Jahr liefert etwas", r.raw_dot_no_year !== null, r.raw_dot_no_year);

  console.log("\nFRIST_RE Erkennung im Text");
  const t = await p.evaluate(() => {
    const proben = [
      "Termin @09.03.2026 fest",
      "Termin @9.3.2026 fest",
      "Termin @9.3. fest",
      "Kontakt info@mo.de bleibt unberuehrt bei fr", // Regressionscheck, kein Absturz erwartet
      "Zeitraum @9.3.2026..14.3.2026 hier",
      "Alt @2026-03-09 hier",
    ];
    return proben.map(s => {
      FRIST_RE.lastIndex = 0;
      const m = FRIST_RE.exec(s);
      return { text: s, treffer: m ? m[0] : null };
    });
  });
  console.log(JSON.stringify(t, null, 2));
  pruefe("@09.03.2026 wird erkannt", t[0].treffer === "@09.03.2026");
  pruefe("@9.3.2026 wird erkannt", t[1].treffer === "@9.3.2026");
  pruefe("@9.3. wird erkannt (die urspruengliche \\b-Falle)", t[2].treffer === "@9.3.");
  pruefe("Zeitraum vollstaendig erkannt", t[4].treffer === "@9.3.2026..14.3.2026");
  pruefe("alte ISO-Schreibweise weiterhin erkannt", t[5].treffer === "@2026-03-09");

  console.log("\nAusschreiben beim Verlassen");
  const zeile = page => page; // noop
  await p.evaluate(() => {
    const n = makeNode("Test @9.3.2026"); n.parentId = ROOT; nodes[n.id] = n; nodes[ROOT].children.push(n.id);
    window.__id = n.id;
    merkmaleSpiegeln(n);
  });
  const vorFocus = await p.evaluate(id => nodes[id].task.due, await p.evaluate(() => window.__id));
  pruefe("task.due korrekt vor dem Ausschreiben", vorFocus === "2026-03-09", vorFocus);

  await p.evaluate(() => { render(false); });
  await p.waitForTimeout(150);
  const row = page => page;
  const id = await p.evaluate(() => window.__id);
  await p.locator('.row[data-id="'+id+'"] .text').click();
  await p.waitForTimeout(80);
  await p.locator("#title").click(); // Feld verlassen
  await p.waitForTimeout(200);
  const nachText = await p.evaluate(id => nodes[id].text, id);
  pruefe("wird beim Verlassen auf TT.MM.JJJJ ausgeschrieben", nachText.indexOf("@09.03.2026") >= 0, nachText);

  console.log("\nAlte ISO-Schreibweise wird beim Bearbeiten umgeschrieben");
  await p.evaluate(() => {
    const n = makeNode("Alt @2026-05-20"); n.parentId = ROOT; nodes[n.id] = n; nodes[ROOT].children.push(n.id);
    window.__id2 = n.id; merkmaleSpiegeln(n); render(false);
  });
  await p.waitForTimeout(150);
  const id2 = await p.evaluate(() => window.__id2);
  await p.locator('.row[data-id="'+id2+'"] .text').click();
  await p.waitForTimeout(80);
  await p.locator("#title").click();
  await p.waitForTimeout(200);
  const nachText2 = await p.evaluate(id => nodes[id].text, id2);
  pruefe("alte ISO wird zu deutschem Format umgeschrieben", nachText2.indexOf("@20.05.2026") >= 0, nachText2);

  pruefe("keine Skriptfehler insgesamt", knall.length === 0, knall.join(" | "));
  await br.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
