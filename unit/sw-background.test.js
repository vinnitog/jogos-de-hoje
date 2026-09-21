const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const serviceWorkerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function createCacheStorage() {
  const stores = new Map();
  const addAllCalls = [];
  let putError = null;

  const storage = {
    async open(name) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }

      const store = stores.get(name);
      return {
        async addAll(requests) {
          addAllCalls.push({ name, requests: [...requests] });
        },
        async match(request) {
          const key = typeof request === "string" ? request : request.url;
          const response = store.get(key);
          return response ? response.clone() : undefined;
        },
        async put(request, response) {
          if (putError) {
            throw putError;
          }
          const key = typeof request === "string" ? request : request.url;
          store.set(key, response.clone());
        }
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
    async match(request) {
      const key = typeof request === "string" ? request : request.url;
      for (const store of stores.values()) {
        const response = store.get(key);
        if (response) {
          return response.clone();
        }
      }
      return undefined;
    }
  };

  storage.seed = (name) => {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
  };
  storage.seedResponse = (name, request, response) => {
    storage.seed(name);
    const key = typeof request === "string" ? request : request.url;
    stores.get(name).set(key, response.clone());
  };
  storage.failWritesWith = (error) => {
    putError = error;
  };
  storage.addAllCalls = addAllCalls;

  return storage;
}

function createEvent() {
  const pending = [];

  return {
    event: {
      waitUntil(promise) {
        pending.push(Promise.resolve(promise));
      }
    },
    async settle() {
      await Promise.all(pending);
    }
  };
}

function createScoreboardEvent({ statusName = "STATUS_IN_PROGRESS", description = "In Progress", score = ["1", "0"] } = {}) {
  return {
    id: "123",
    date: "2026-06-15T19:00Z",
    competitions: [
      {
        date: "2026-06-15T19:00Z",
        status: {
          type: {
            state: "in",
            completed: false,
            name: statusName,
            description
          }
        },
        competitors: [
          {
            homeAway: "home",
            score: score[0],
            team: {
              displayName: "Palmeiras"
            }
          },
          {
            homeAway: "away",
            score: score[1],
            team: {
              displayName: "Flamengo"
            }
          }
        ]
      }
    ]
  };
}

function createHarness({ fetchImpl } = {}) {
  const listeners = {};
  const notifications = [];
  const caches = createCacheStorage();
  const lifecycle = {
    claimCalls: 0,
    skipWaitingCalls: 0
  };
  const clients = {
    async claim() {
      lifecycle.claimCalls += 1;
    },
    matchAll: async () => [],
    openWindow: async () => undefined
  };
  const self = {
    registration: {
      async showNotification(title, options) {
        notifications.push({ title, options });
      }
    },
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
    clients,
    skipWaiting() {
      lifecycle.skipWaitingCalls += 1;
    }
  };
  const context = {
    Request,
    Response,
    URLSearchParams,
    Intl,
    Date,
    caches,
    fetch: fetchImpl || (async () => new Response(JSON.stringify({ events: [] }))),
    self,
    clients
  };

  vm.runInNewContext(serviceWorkerSource, context, {
    filename: "sw.js"
  });

  async function postGoalState(data) {
    let ack = null;
    const { event, settle } = createEvent();
    event.data = {
      type: "goal-notifications-state",
      ...data
    };
    event.ports = [
      {
        postMessage(message) {
          ack = message;
        }
      }
    ];

    listeners.message(event);
    await settle();
    return ack;
  }

  async function triggerSync(tag = "goal-notifications-live") {
    const { event, settle } = createEvent();
    event.tag = tag;
    listeners.sync(event);
    await settle();
  }

  async function triggerLifecycle(type) {
    const { event, settle } = createEvent();
    listeners[type](event);
    await settle();
  }

  async function triggerFetch(url) {
    let responsePromise;
    const request = new Request(url);
    const { event, settle } = createEvent();
    event.request = request;
    event.respondWith = (promise) => {
      responsePromise = Promise.resolve(promise);
    };

    listeners.fetch(event);
    const response = await responsePromise;
    await settle();
    return response;
  }

  async function readGoalState() {
    const cache = await caches.open("jogos-hoje-goal-state-v1");
    const response = await cache.match("https://jogos-hoje.local/goal-notification-state");
    return response ? response.json() : null;
  }

  return {
    caches,
    lifecycle,
    listeners,
    notifications,
    postGoalState,
    readGoalState,
    triggerLifecycle,
    triggerFetch,
    triggerSync
  };
}

test("service worker migrates goal state out of the old versioned app cache", async () => {
  const harness = createHarness();
  const state = {
    enabled: true,
    dateISO: "2026-08-28",
    games: [{ id: "bra.1-123", score: "1 x 0" }],
    notifiedTags: ["gol-bra.1-123-1 x 0"]
  };
  harness.caches.seedResponse(
    "jogos-hoje-v9",
    "https://jogos-hoje.local/goal-notification-state",
    new Response(
      JSON.stringify({ enabled: false, games: [{ id: "old", score: "0 x 0" }] }),
      { headers: { "Content-Type": "application/json" } }
    )
  );
  harness.caches.seedResponse(
    "jogos-hoje-v15",
    "https://jogos-hoje.local/goal-notification-state",
    new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } })
  );
  harness.caches.seed("jogos-hoje-v17");

  await harness.triggerLifecycle("activate");

  assert.equal((await harness.readGoalState()).enabled, true);
  assert.equal((await harness.readGoalState()).games[0].score, "1 x 0");
  assert.equal((await harness.caches.keys()).includes("jogos-hoje-v15"), false);
  assert.equal((await harness.caches.keys()).includes("jogos-hoje-goal-state-v1"), true);
});

test("service worker does not cache unsuccessful data or ESPN responses", async () => {
  for (const url of [
    "https://jogos-hoje.test/data/jogos.json",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"
  ]) {
    const harness = createHarness({
      fetchImpl: async () => new Response("upstream error", { status: 503 })
    });

    const response = await harness.triggerFetch(url);

    assert.equal(response.status, 503);
    assert.equal(await harness.caches.match(url), undefined);
  }
});

test("service worker caches successful data and ESPN responses", async () => {
  for (const url of [
    "https://jogos-hoje.test/data/jogos.json",
    "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"
  ]) {
    const harness = createHarness({
      fetchImpl: async () => new Response("fresh payload", { status: 200 })
    });

    const response = await harness.triggerFetch(url);
    const cached = await harness.caches.match(url);

    assert.equal(await response.text(), "fresh payload");
    assert.equal(await cached.text(), "fresh payload");
  }
});

test("service worker returns a cached data response when the network fails", async () => {
  const url = "https://jogos-hoje.test/data/jogos.json";
  const harness = createHarness({
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });
  harness.caches.seedResponse(
    "jogos-hoje-v17",
    url,
    new Response("cached payload", { status: 200 })
  );

  const response = await harness.triggerFetch(url);

  assert.equal(await response.text(), "cached payload");
});

test("service worker still returns a successful network response when cache storage fails", async () => {
  const url = "https://jogos-hoje.test/data/jogos.json";
  const harness = createHarness({
    fetchImpl: async () => new Response("network payload", { status: 200 })
  });
  harness.caches.failWritesWith(new Error("quota exceeded"));

  const response = await harness.triggerFetch(url);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "network payload");
});

test("service worker installs the complete app shell in cache v17", async () => {
  const harness = createHarness();

  await harness.triggerLifecycle("install");

  assert.deepEqual(await harness.caches.keys(), ["jogos-hoje-v17"]);
  assert.equal(harness.lifecycle.skipWaitingCalls, 1);
  assert.equal(harness.caches.addAllCalls.length, 1);
  assert.equal(harness.caches.addAllCalls[0].name, "jogos-hoje-v17");
  assert.deepEqual(harness.caches.addAllCalls[0].requests, [
    ".",
    "index.html",
    "css/app.css",
    "js/app.js",
    "data/jogos.json",
    "manifest.json",
    "icons/icon.svg"
  ]);
});

test("service worker upgrade removes only older app caches", async () => {
  const harness = createHarness();
  await harness.postGoalState({
    enabled: true,
    dateISO: "2026-06-15",
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });
  for (const cacheName of [
    "jogos-hoje-v12",
    "jogos-hoje-v13",
    "jogos-hoje-v14",
    "jogos-hoje-v15",
    "jogos-hoje-v16",
    "jogos-hoje-v17",
    "images-v3",
    "another-app-cache"
  ]) {
    harness.caches.seed(cacheName);
  }

  await harness.triggerLifecycle("activate");

  assert.deepEqual((await harness.caches.keys()).sort(), [
    "another-app-cache",
    "images-v3",
    "jogos-hoje-goal-state-v1",
    "jogos-hoje-v17"
  ]);
  assert.equal((await harness.readGoalState()).games[0].score, "0 x 0");
  assert.equal(harness.lifecycle.claimCalls, 1);
});

test("service worker stores goal notification state and acknowledges the app", async () => {
  const harness = createHarness();
  const ack = await harness.postGoalState({
    enabled: true,
    dateISO: "2026-06-15",
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });

  const state = await harness.readGoalState();

  assert.equal(ack.ok, true);
  assert.equal(state.enabled, true);
  assert.equal(state.games[0].score, "0 x 0");
});

test("service worker keeps the current score snapshot when the app sends preference only", async () => {
  const harness = createHarness();

  await harness.postGoalState({
    enabled: true,
    dateISO: "2026-06-15",
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });
  await harness.postGoalState({
    enabled: true
  });

  const state = await harness.readGoalState();

  assert.equal(state.enabled, true);
  assert.equal(state.games[0].score, "0 x 0");
  assert.equal(state.dateISO, "2026-06-15");
});

test("service worker sync notifies a goal detected during halftime and updates state", async () => {
  const requestedUrls = [];
  const harness = createHarness({
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      const events = String(url).includes("/bra.1/")
        ? [createScoreboardEvent({ statusName: "STATUS_HALFTIME", description: "Intervalo" })]
        : [];
      return new Response(JSON.stringify({ events }));
    }
  });

  await harness.postGoalState({
    enabled: true,
    dateISO: "2026-06-15",
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });
  await harness.triggerSync();

  const state = await harness.readGoalState();

  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].title, "Gol do Palmeiras!");
  assert.equal(harness.notifications[0].options.body, "Brasileirão Série A: Palmeiras 1 x 0 Flamengo");
  assert.equal(harness.notifications[0].options.tag, "gol-bra.1-123-1 x 0");
  assert.equal(state.games[0].status, "halftime");
  assert.equal(state.games.length, 1);
  assert.deepEqual(state.notifiedTags, ["gol-bra.1-123-1 x 0"]);
  assert.equal(requestedUrls.length, 15);
  const datesByLeague = new Map();
  requestedUrls.forEach((url) => {
    const segments = new URL(url).pathname.split("/");
    const league = segments.at(-2);
    datesByLeague.set(league, [...(datesByLeague.get(league) || []), url]);
  });

  assert.equal(datesByLeague.size, 5);
  const expectedDates = requestedUrls
    .slice(0, 3)
    .map((url) => new URL(url).searchParams.get("dates"))
    .sort();
  for (const urls of datesByLeague.values()) {
    const dates = urls.map((url) => new URL(url).searchParams.get("dates")).sort();
    assert.equal(new Set(dates).size, 3);
    assert.deepEqual(dates, expectedDates);
    const timestamps = dates.map((date) => Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(4, 6)) - 1,
      Number(date.slice(6, 8))
    ));
    assert.deepEqual(
      [timestamps[1] - timestamps[0], timestamps[2] - timestamps[1]],
      [86_400_000, 86_400_000]
    );
  }
});

test("service worker does not fetch or notify when goal notifications are disabled", async () => {
  let fetchCount = 0;
  const harness = createHarness({
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ events: [] }));
    }
  });

  await harness.postGoalState({
    enabled: false,
    games: [
      {
        id: "bra.1-123",
        status: "live",
        score: "0 x 0"
      }
    ]
  });
  await harness.triggerSync();

  assert.equal(fetchCount, 0);
  assert.equal(harness.notifications.length, 0);
});

test("service worker does not duplicate an already tracked goal notification", async () => {
  const harness = createHarness({
    fetchImpl: async (url) => {
      const events = String(url).includes("/bra.1/") ? [createScoreboardEvent()] : [];
      return new Response(JSON.stringify({ events }));
    }
  });

  await harness.postGoalState({
    enabled: true,
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });

  await harness.triggerSync();
  await harness.triggerSync();

  assert.equal(harness.notifications.length, 1);
});

test("service worker preserves a league snapshot while one date request is incomplete", async () => {
  let partialRefresh = true;
  let failedOneDate = false;
  const harness = createHarness({
    fetchImpl: async (url) => {
      const isBrasileirao = String(url).includes("/bra.1/");

      if (partialRefresh && isBrasileirao && !failedOneDate) {
        failedOneDate = true;
        return new Response("upstream error", { status: 500 });
      }

      const events = !partialRefresh && isBrasileirao ? [createScoreboardEvent()] : [];
      return new Response(JSON.stringify({ events }));
    }
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  await harness.postGoalState({
    enabled: true,
    dateISO: today,
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: today,
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });

  await harness.triggerSync();
  assert.equal((await harness.readGoalState()).games[0].score, "0 x 0");
  assert.equal(harness.notifications.length, 0);

  partialRefresh = false;
  await harness.triggerSync();

  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].options.tag, "gol-bra.1-123-1 x 0");
  assert.equal((await harness.readGoalState()).games[0].score, "1 x 0");
});

test("service worker preserves goal state when every scoreboard request fails", async () => {
  const harness = createHarness({
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });

  await harness.postGoalState({
    enabled: true,
    dateISO: "2026-06-15",
    games: [
      {
        id: "bra.1-123",
        competition: "Brasileirão Série A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "0 x 0"
      }
    ]
  });
  await harness.triggerSync();

  const state = await harness.readGoalState();

  assert.equal(harness.notifications.length, 0);
  assert.equal(state.games[0].score, "0 x 0");
  assert.equal(state.notifiedTags.length, 0);
});
