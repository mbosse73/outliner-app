// Rueckgaengig gemachte Punkte duerfen keine Waisen in nodes hinterlassen
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const DATEI = path.join(__dirname, "..", "index.html");
let fehler = 0, ok = 0;
const pruefe = (n,b,z) => b ? (ok++, console.log("  ok   "+n)) : (fehler++, console.log("  FEHL "+n+(z?"  → "+z:"")));
(async () => {
  const server = http.createServer((q,r)=>{r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});r.end(fs.readFileSync(DATEI));}).listen(0);
  const url = "http://127.0.0.1:"+server.address().port+"/";
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p = await (await b.newContext()).newPage();
  const knall = []; p.on("pageerror", e => knall.push(String(e)));
  await p.goto(url); await p.waitForSelector(".row");
  await p.addInitScript(() => {});
  const messen = () => p.evaluate(() => {
    let n = 0;
    const geh = id => { n++; for (const c of nodes[id].children) geh(c); };
    geh("root");
    return { gesamt: Object.keys(nodes).length, erreichbar: n };
  });

  console.log("\nA — Enter am Zeilenende");
  const a0 = await messen();
  await p.locator(".row .text").first().click();
  await p.keyboard.press("End"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  const a1 = await messen();
  pruefe("keine Waise", a1.gesamt === a1.erreichbar, JSON.stringify(a1));
  pruefe("Stand wie vorher", a1.gesamt === a0.gesamt, a0.gesamt + " → " + a1.gesamt);

  console.log("\nB — Enter am Zeilenanfang (eigener Zweig im Code)");
  await p.locator(".row .text").first().click();
  await p.keyboard.press("Home"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  const b1 = await messen();
  pruefe("keine Waise", b1.gesamt === b1.erreichbar, JSON.stringify(b1));

  console.log("\nC — Enter mitten im Text (Teilen)");
  await p.locator(".row .text").first().click();
  await p.evaluate(() => { const el = document.querySelector(".row .text"); setCaret(el, 3); });
  await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  const c1 = await messen();
  pruefe("keine Waise", c1.gesamt === c1.erreichbar, JSON.stringify(c1));

  console.log("\nD — Erster Punkt in einem leeren Zweig");
  await p.evaluate(() => {
    const leer = Object.keys(nodes).find(i => i !== "root" && !nodes[i].children.length);
    zoomTo(leer);
  });
  await p.waitForTimeout(150);
  await p.evaluate(() => newFirstChild());
  await p.waitForTimeout(120);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  const d1 = await messen();
  pruefe("keine Waise", d1.gesamt === d1.erreichbar, JSON.stringify(d1));

  console.log("\nE — Zaehler stimmt");
  await p.evaluate(() => { zoomTo(ROOT); render(false); });
  await p.waitForTimeout(150);
  const e1 = await messen();
  const untertitel = await p.locator("#subtitle").textContent();
  pruefe("Untertitel nennt die erreichbaren Punkte",
    untertitel.indexOf(String(e1.erreichbar - 1)) === 0, untertitel + " bei " + (e1.erreichbar - 1));

  console.log("\nF — Wiederherstellen bringt den Punkt zurueck");
  await p.locator(".row .text").first().click();
  await p.keyboard.press("End"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  const f1 = await messen();
  await p.keyboard.press("Control+z"); await p.waitForTimeout(150);
  await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(150);
  const f2 = await messen();
  pruefe("Strg+Umschalt+Z stellt ihn wieder her", f2.gesamt === f1.gesamt && f2.gesamt === f2.erreichbar,
    JSON.stringify(f2));

  pruefe("keine Skriptfehler", knall.length === 0, knall[0]);
  await b.close(); server.close();
  console.log("\n" + ok + " ok, " + fehler + " Fehler");
  process.exit(fehler ? 1 : 0);
})();
