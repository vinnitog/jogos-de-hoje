const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("pwa files exist", () => {
  for (const file of [
    "index.html",
    "css/app.css",
    "js/app.js",
    "data/jogos.json",
    "manifest.json",
    "sw.js",
    "icons/icon.svg"
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
  }
});

test("html wires app assets and service worker script", () => {
  const html = read("index.html");

  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="stylesheet" href="css\/app\.css">/);
  assert.match(html, /<script src="js\/app\.js" defer><\/script>/);
  assert.match(html, /id="source-label"/);
});

test("manifest is installable enough for static hosting", () => {
  const manifest = JSON.parse(read("manifest.json"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, ".");
  assert.ok(manifest.icons.some((icon) => icon.src === "icons/icon.svg"));
});

test("service worker caches the app shell and data source", () => {
  const serviceWorker = read("sw.js");

  assert.match(serviceWorker, /jogos-hoje-v2/);
  assert.match(serviceWorker, /site\.api\.espn\.com/);
  for (const asset of ["index.html", "css/app.css", "js/app.js", "data/jogos.json"]) {
    assert.match(serviceWorker, new RegExp(asset.replace(".", "\\.")));
  }
});

test("local fallback has no fake matches", () => {
  const data = JSON.parse(read("data/jogos.json"));

  assert.deepEqual(data.games, []);
  assert.equal(data.source.type, "offline");
});

test("app exposes all supported competitions in source", () => {
  const app = read("js/app.js");

  for (const label of [
    "Brasileirão Série A",
    "Paulista Série A1",
    "Libertadores",
    "Copa do Brasil",
    "Copa do Mundo 2026"
  ]) {
    assert.match(app, new RegExp(label));
  }
});
