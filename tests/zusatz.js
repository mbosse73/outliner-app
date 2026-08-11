// Nachtrag: Frist folgt dem Text auch beim Teilen und Verbinden
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
  const fehlerListe = []; page.on("pageerror", e => fehlerListe.push(String(e)));
  await page.goto(url); await page.waitForSelector(".row");

  console.log("\n12 — Zeile mit Frist teilen (Enter)");
  const zeile = page.locator(".row").last();
  await zeile.locator(".text").click();
  await page.keyboard.type("Antrag stellen @2026-03-09");
  await page.locator("#title").click(); await page.waitForTimeout(100);
  const id1 = await zeile.getAttribute("data-id");
  pruefe("Frist sitzt im Modell", await page.evaluate(i => nodes[i].task.due === "2026-03-09", id1));

  // Cursor hinter "Antrag" setzen und teilen
  await zeile.locator(".text").click();
  await page.evaluate(i => { const el = document.querySelector('.row[data-id="'+i+'"] .text'); setCaret(el, 6); }, id1);
  await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  const geteilt = await page.evaluate(i => {
    const alt = nodes[i];
    const p = nodes[alt.parentId];
    const neu = nodes[p.children[p.children.indexOf(i) + 1]];
    return { altText: alt.text, altDue: alt.task ? alt.task.due : null,
             neuText: neu.text, neuDue: neu.task ? neu.task.due : null };
  }, id1);
  pruefe("die Frist wandert zur Haelfte mit dem Datum",
    geteilt.altDue === null && geteilt.neuDue === "2026-03-09",
    JSON.stringify(geteilt));

  console.log("\n13 — Zeilen mit Frist verbinden (Ruecktaste)");
  await page.evaluate(i => {
    const p = nodes[nodes[i].parentId];
    const neuId = p.children[p.children.indexOf(i) + 1];
    focusState = { id: neuId, field: "text", pos: 0 };
    applyFocus();
  }, id1);
  await page.keyboard.press("Backspace"); await page.waitForTimeout(100);
  const verbunden = await page.evaluate(i => ({ text: nodes[i].text, due: nodes[i].task ? nodes[i].task.due : null }), id1);
  pruefe("die verbundene Zeile traegt die Frist wieder",
    verbunden.text.includes("@09.03.2026") && verbunden.due === "2026-03-09",
    JSON.stringify(verbunden));
  pruefe("keine Skriptfehler", fehlerListe.length === 0, fehlerListe[0]);

  await browser.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
