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
  assert.match(html, /id="date-display"/);
  assert.match(html, /id="calendar-grid"/);
  assert.match(html, /id="auto-refresh-status"/);
  assert.match(html, /id="goal-notifications-toggle"/);
  assert.doesNotMatch(html, /type="date"/);
});

test("goal notification toggle is accessible and linked to status text", () => {
  const html = read("index.html");

  assert.match(html, /id="goal-notifications-toggle"[\s\S]*role="switch"/);
  assert.match(html, /id="goal-notifications-toggle"[\s\S]*aria-describedby="goal-notification-status"/);
  assert.match(html, /id="goal-notifications-toggle"[\s\S]*aria-label="Notificacoes de gol"/);
  assert.match(html, /id="goal-notification-status"/);
  assert.doesNotMatch(html, /id="goal-notification-status"[^>]*aria-live/);
});

test("manifest is installable enough for static hosting", () => {
  const manifest = JSON.parse(read("manifest.json"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, ".");
  assert.ok(manifest.icons.some((icon) => icon.src === "icons/icon.svg"));
});

test("service worker caches the app shell and data source", () => {
  const serviceWorker = read("sw.js");

  assert.match(serviceWorker, /jogos-hoje-v6/);
  assert.match(serviceWorker, /site\.api\.espn\.com/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /clients\.matchAll/);
  assert.match(serviceWorker, /\.focus\(\)/);
  assert.match(serviceWorker, /clients\.openWindow/);
  for (const asset of ["index.html", "css/app.css", "js/app.js", "data/jogos.json"]) {
    assert.match(serviceWorker, new RegExp(asset.replace(".", "\\.")));
  }
});

test("goal notification source persists preference and requests permission", () => {
  const app = read("js/app.js");

  assert.match(app, /GOAL_NOTIFICATIONS_STORAGE_KEY\s*=\s*"jogos-hoje-goal-notifications"/);
  assert.match(app, /localStorage\.setItem\(GOAL_NOTIFICATIONS_STORAGE_KEY,\s*enabled \? "on" : "off"\)/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /Notification\.permission === "granted"/);
  assert.match(app, /Notification\.permission === "denied"/);
});

test("goal notification refresh compares previous and next games", () => {
  const app = read("js/app.js");

  assert.match(app, /const previousGames = state\.data\.games \|\| \[\]/);
  assert.match(app, /notifyGoalEvents\(previousGames,\s*nextData\.games \|\| \[\]\)/);
  assert.match(app, /state\.data = nextData/);
});

test("goal notification payload uses stable tag and app icons", () => {
  const app = read("js/app.js");

  assert.match(app, /tag:\s*`gol-\$\{goalEvent\.id\}-\$\{goalEvent\.score\}`/);
  assert.match(app, /renotify:\s*true/);
  assert.match(app, /icon:\s*"icons\/icon\.svg"/);
  assert.match(app, /badge:\s*"icons\/icon\.svg"/);
  assert.match(app, /data:\s*\{[\s\S]*url:\s*"."[\s\S]*\}/);
});

test("goal notification uses service worker with browser fallback", () => {
  const app = read("js/app.js");

  assert.match(app, /showServiceWorkerNotification\(goalEvent\.title,\s*options\)/);
  assert.match(app, /createBrowserNotification\(goalEvent\.title,\s*options\)/);
  assert.match(app, /NOTIFICATION_SERVICE_WORKER_TIMEOUT/);
});

test("notification click closes notification and returns to app", () => {
  const serviceWorker = read("sw.js");

  assert.match(serviceWorker, /event\.notification\.close\(\)/);
  assert.match(
    serviceWorker,
    /clients\.matchAll\(\{\s*type:\s*"window",\s*includeUncontrolled:\s*true\s*\}\)/s
  );
  assert.match(serviceWorker, /clients\.openWindow\(event\.notification\.data\?\.url \|\| "\."\)/);
});

test("competition filters wrap instead of using horizontal scroll", () => {
  const css = read("css/app.css");

  assert.match(css, /\.competition-tabs\s*{[^}]*display:\s*grid/s);
  assert.doesNotMatch(css, /\.competition-tabs\s*{[^}]*overflow-x:\s*auto/s);
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
