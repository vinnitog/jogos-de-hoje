const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function openingTags(fragment, names) {
  const matcher = new RegExp(`<(${names.join("|")})\\b`, "gi");
  return [...fragment.matchAll(matcher)].map((match) => match[1].toLowerCase());
}

function openingTagById(html, id) {
  return html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, "i"))?.[0] || "";
}

function blockAfter(source, pattern) {
  const match = source.match(pattern);
  if (!match) {
    return "";
  }

  const openingBrace = source.indexOf("{", match.index + match[0].length);
  if (openingBrace === -1) {
    return "";
  }

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBrace + 1, index);
      }
    }
  }

  return "";
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
  assert.doesNotMatch(html, /id="connection-status"/);
  assert.doesNotMatch(html, /id="search-filter"/);
  assert.doesNotMatch(html, /id="source-label"/);
  assert.match(html, /id="date-display"/);
  assert.match(html, /id="calendar-grid"/);
  assert.match(html, /id="auto-refresh-status"/);
  assert.match(html, /id="goal-notifications-toggle"/);
  assert.match(html, /id="whatsapp-button"/);
  assert.match(html, /id="whatsapp-panel"/);
  assert.match(html, /id="whatsapp-open-button"/);
  assert.match(html, /id="whatsapp-copy-button"/);
  assert.doesNotMatch(html, /type="tel"/);
  assert.doesNotMatch(html, /id="world-cup-button"/);
  assert.match(html, /id="world-cup-panel"/);
  assert.match(html, /id="world-cup-views"/);
  assert.match(html, /id="world-cup-content"/);
  assert.match(html, /data-view="groups"/);
  assert.match(html, /data-view="bracket"/);
  assert.doesNotMatch(html, /type="date"/);
});

test("description lists keep each term before its description", () => {
  const html = read("index.html");
  const lists = [...html.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/gi)];

  assert.ok(lists.length >= 2, "summary and game details should use description lists");
  for (const [, contents] of lists) {
    const tags = openingTags(contents, ["dt", "dd"]);
    assert.ok(tags.length > 0, "each description list should contain terms and descriptions");
    assert.equal(tags.length % 2, 0, "description list tags should form complete pairs");
    for (let index = 0; index < tags.length; index += 2) {
      assert.deepEqual(tags.slice(index, index + 2), ["dt", "dd"]);
    }
  }
});

test("interactive filters and World Cup views expose stable ARIA state", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  const competitionFilter = openingTagById(html, "competition-filter");
  const tabList = openingTagById(html, "world-cup-views");
  const groupsTab = openingTagById(html, "wc-tab-groups");
  const bracketTab = openingTagById(html, "wc-tab-bracket");
  const tabPanel = openingTagById(html, "world-cup-content");

  assert.match(competitionFilter, /role="group"/);
  assert.match(competitionFilter, /aria-label=/);
  assert.match(app, /button\.setAttribute\("aria-pressed",\s*String\(competition === state\.selectedCompetition\)\)/);

  assert.match(tabList, /role="tablist"/);
  for (const tab of [groupsTab, bracketTab]) {
    assert.match(tab, /role="tab"/);
    assert.match(tab, /aria-controls="world-cup-content"/);
  }
  assert.match(groupsTab, /aria-selected="true"/);
  assert.match(groupsTab, /tabindex="0"/);
  assert.match(bracketTab, /aria-selected="false"/);
  assert.match(bracketTab, /tabindex="-1"/);
  assert.match(tabPanel, /role="tabpanel"/);
  assert.match(tabPanel, /aria-labelledby="wc-tab-groups"/);
  assert.match(app, /tab\.setAttribute\("aria-selected",\s*String\(isActive\)\)/);
  assert.match(app, /tab\.tabIndex\s*=\s*isActive \? 0 : -1/);
  assert.match(app, /\["ArrowLeft",\s*"ArrowRight",\s*"Home",\s*"End"\]/);
  assert.match(app, /tabs\[nextIndex\]\?\.focus\(\)/);

  assert.match(app, /content\.setAttribute\("aria-busy",\s*String\(wc\.loading\)\)/);
  assert.match(app, /#game-list"\)\?\.setAttribute\("aria-busy",\s*"true"\)/);
  assert.match(app, /#game-list"\)\?\.setAttribute\("aria-busy",\s*"false"\)/);
});

test("footer gives a concise privacy and third-party disclosure", () => {
  const html = read("index.html");
  const privacyNote = html.match(/<details class="privacy-note">([\s\S]*?)<\/details>/)?.[1];

  assert.ok(privacyNote, "privacy note should be present in the app footer");
  assert.match(privacyNote, /Sem cadastro, anúncios ou rastreadores/i);
  assert.match(privacyNote, /somente neste dispositivo/i);
  assert.match(privacyNote, /ESPN/);
  assert.match(privacyNote, /FlagCDN/);
  assert.match(privacyNote, /WhatsApp[^.]*apenas por sua ação/i);
});

test("html omits the removed status, search and list action labels", () => {
  const html = read("index.html");
  const listActions = html.match(/<div class="list-actions">([\s\S]*?)<\/div>/)?.[1];
  const worldCupPanel = html.match(
    /<section class="world-cup-panel"[\s\S]*?<\/section>/
  )?.[0];

  assert.ok(listActions, "list actions should remain available");
  assert.ok(worldCupPanel, "World Cup panel should remain available");
  assert.doesNotMatch(html, /<input\b[^>]*\btype=["']search["']/i);
  assert.doesNotMatch(html, /placeholder=["']Time, estádio ou canal["']/i);
  assert.doesNotMatch(html, />\s*Online\s*</i);
  assert.doesNotMatch(html, />\s*Gols:\s*desligado\s*</i);
  assert.doesNotMatch(listActions, /Copa\s*(?:do Mundo\s*)?2026/i);
  assert.doesNotMatch(listActions, /world-cup-button/);
  assert.match(worldCupPanel, /Copa do Mundo 2026/);
  assert.match(worldCupPanel, /id="world-cup-views"/);
});

test("goal notification toggle remains accessible without redundant status text", () => {
  const html = read("index.html");

  assert.match(html, /id="goal-notifications-toggle"[\s\S]*role="switch"/);
  assert.match(html, /id="goal-notifications-toggle"[\s\S]*aria-label="Notificações de gol"/);
  assert.doesNotMatch(html, /id="goal-notification-status"/);
});

test("manifest is installable enough for static hosting", () => {
  const manifest = JSON.parse(read("manifest.json"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, ".");
  assert.ok(manifest.icons.some((icon) => icon.src === "icons/icon.svg"));
});

test("service worker caches the app shell and data source", () => {
  const serviceWorker = read("sw.js");

  assert.match(serviceWorker, /jogos-hoje-v15/);
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
  assert.match(app, /GOAL_BACKGROUND_SYNC_TAG\s*=\s*"goal-notifications-live"/);
  assert.match(app, /localStorage\.setItem\(GOAL_NOTIFICATIONS_STORAGE_KEY,\s*enabled \? "on" : "off"\)/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /Notification\.permission === "granted"/);
  assert.match(app, /Notification\.permission === "denied"/);
});

test("WhatsApp share does not collect contacts and opens a wa.me selector", () => {
  const app = read("js/app.js");
  const html = read("index.html");
  const css = read("css/app.css");

  assert.doesNotMatch(app, /const WHATSAPP_CONTACT_STORAGE_KEY/);
  assert.doesNotMatch(app, /WHATSAPP_PRESET_CONTACTS/);
  assert.doesNotMatch(app, /sealedDigits/);
  assert.doesNotMatch(app, /(?:atob|fromCharCode)\s*\([^)]*(?:whatsapp|contact|phone)/i);
  assert.doesNotMatch(app, /(?:whatsapp|contact|phone)[\s\S]{0,80}\.reverse\(\)\.join\(/i);
  assert.doesNotMatch(app, /localStorage[^\n]*phone/i);
  assert.doesNotMatch(app, /https:\/\/wa\.me\/\d/);
  assert.match(app, /removeItem\(LEGACY_WHATSAPP_CONTACT_STORAGE_KEY\)/);
  assert.match(app, /https:\/\/wa\.me\/\?text=/);
  assert.match(app, /formatGamesShareMessage\(getCurrentFilteredGames\(\)/);
  assert.match(app, /navigator\.clipboard/);
  assert.doesNotMatch(html, /autocomplete="tel"/);
  assert.match(css, /\.share-panel\[hidden\]\s*{[^}]*display:\s*none/s);
  assert.match(css, /\.icon-button--whatsapp/);
});

test("goal notification refresh compares previous and next games", () => {
  const app = read("js/app.js");

  assert.match(app, /const previousGames = state\.data\.games \|\| \[\]/);
  assert.match(app, /const nextGames = nextData\.games \|\| \[\]/);
  assert.match(app, /notifyGoalEvents\(previousGames,\s*nextGames\)/);
  assert.match(app, /state\.data = nextData/);
  assert.match(app, /postGoalNotificationStateToServiceWorker\(nextGames\)/);
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
  assert.match(app, /navigator\.serviceWorker\.ready/);
  assert.match(app, /registerAppServiceWorker\(\)/);
});

test("goal notification background sync is wired through the service worker", () => {
  const app = read("js/app.js");
  const serviceWorker = read("sw.js");

  assert.match(app, /registration\.periodicSync\.register\(GOAL_BACKGROUND_SYNC_TAG/);
  assert.doesNotMatch(app, /registration\.sync\.register\(GOAL_BACKGROUND_SYNC_TAG\)/);
  assert.match(app, /MessageChannel/);
  assert.match(app, /type:\s*"goal-notifications-state"/);
  assert.match(app, /worker\.postMessage\(payload/);
  assert.match(app, /includeSnapshot/);
  assert.match(app, /syncTodayGoalNotificationSnapshot/);
  assert.match(serviceWorker, /GOAL_STATE_CACHE_KEY/);
  assert.match(serviceWorker, /periodicsync/);
  assert.match(serviceWorker, /self\.addEventListener\("sync"/);
  assert.match(serviceWorker, /syncGoalNotifications/);
  assert.match(serviceWorker, /showNotification\(goalEvent\.title/);
  assert.match(serviceWorker, /event\.ports\?\.\[0\]\?\.postMessage/);
  assert.match(serviceWorker, /LIVE_SCORE_STATUSES\s*=\s*\["live",\s*"halftime",\s*"finished"\]/);
  assert.match(
    app,
    /navigator\.serviceWorker\?\.addEventListener\("controllerchange",\s*\(\)\s*=>\s*{\s*postGoalNotificationStateToServiceWorker\(\);\s*}\)/s
  );
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

test("filter card separates date and competitions only on wide screens", () => {
  const css = read("css/app.css");
  const baseCompetitionField = blockAfter(css, /\.competition-field\s*(?=\{)/);
  const baseFilters = blockAfter(css, /\.filters\s*(?=\{)/);
  const wideScreen = blockAfter(css, /@media\s*\(min-width:\s*960px\)\s*(?=\{)/);
  const wideFilters = blockAfter(wideScreen, /\.filters\s*(?=\{)/);
  const wideDateField = blockAfter(wideScreen, /\.date-field\s*(?=\{)/);
  const wideCompetitionField = blockAfter(wideScreen, /\.competition-field\s*(?=\{)/);
  const competitionTabs = blockAfter(css, /\.competition-tabs\s*(?=\{)/);
  const tabButton = blockAfter(css, /\.tab-button\s*(?=\{)/);

  assert.match(baseFilters, /display:\s*grid/);
  assert.match(baseFilters, /gap:\s*16px/);
  assert.doesNotMatch(baseCompetitionField, /border-left/);
  assert.doesNotMatch(baseFilters, /grid-template-columns/);
  assert.match(
    wideFilters,
    /grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s+minmax\(0,\s*1\.1fr\)/
  );
  assert.match(wideFilters, /gap:\s*0/);
  assert.match(wideDateField, /min-width:\s*0/);
  assert.match(wideDateField, /padding-right:\s*24px/);
  assert.match(wideCompetitionField, /min-width:\s*0/);
  assert.match(wideCompetitionField, /border-left:\s*1px solid var\(--color-border\)/);
  assert.match(wideCompetitionField, /padding-left:\s*24px/);
  assert.match(competitionTabs, /minmax\(min\(100%,\s*8\.5rem\),\s*1fr\)/);
  assert.match(tabButton, /min-width:\s*0/);
  assert.match(tabButton, /white-space:\s*normal/);
  assert.match(tabButton, /overflow-wrap:\s*anywhere/);
});

test("closing the date popover restores focus only from inside the calendar", () => {
  const app = read("js/app.js");
  const body = blockAfter(app, /function setDatePopoverOpen\(isOpen\)\s*(?=\{)/);
  const internalControl = {};
  const externalControl = {};
  const popover = {
    hidden: false,
    contains(element) {
      return element === internalControl;
    }
  };
  const focusCalls = [];
  const attributes = new Map();
  const display = {
    focus() {
      focusCalls.push("display");
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    }
  };
  const document = {
    activeElement: externalControl,
    querySelector(selector) {
      return selector === "#date-popover" ? popover : display;
    }
  };

  assert.ok(body, "setDatePopoverOpen should remain available for behavior testing");

  const setDatePopoverOpen = vm.runInNewContext(
    `(function setDatePopoverOpen(isOpen) {${body}})`,
    { document, renderCalendar() {} }
  );

  setDatePopoverOpen(false);
  assert.equal(popover.hidden, true);
  assert.equal(attributes.get("aria-expanded"), "false");
  assert.deepEqual(focusCalls, [], "closing from an external control must not steal focus");

  popover.hidden = false;
  document.activeElement = internalControl;
  setDatePopoverOpen(false);
  assert.deepEqual(focusCalls, ["display"], "closing from inside should return focus to the trigger");
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
