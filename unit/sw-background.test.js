const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const serviceWorkerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function createCacheStorage() {
  const stores = new Map();

  return {
    async open(name) {
      if (!stores.has(name)) {
        stores.set(name, new Map());
      }

      const store = stores.get(name);
      return {
        async addAll() {},
        async match(request) {
          const key = typeof request === "string" ? request : request.url;
          const response = store.get(key);
          return response ? response.clone() : undefined;
        },
        async put(request, response) {
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
    }
  };
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
  const self = {
    registration: {
      async showNotification(title, options) {
        notifications.push({ title, options });
      }
    },
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
    skipWaiting() {}
  };
  const context = {
    Response,
    URLSearchParams,
    Intl,
    Date,
    caches,
    fetch: fetchImpl || (async () => new Response(JSON.stringify({ events: [] }))),
    self,
    clients: {
      matchAll: async () => [],
      openWindow: async () => undefined
    }
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

  async function readGoalState() {
    const cache = await caches.open("jogos-hoje-v7");
    const response = await cache.match("https://jogos-hoje.local/goal-notification-state");
    return response ? response.json() : null;
  }

  return {
    listeners,
    notifications,
    postGoalState,
    readGoalState,
    triggerSync
  };
}

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
  const harness = createHarness({
    fetchImpl: async (url) => {
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
  assert.deepEqual(state.notifiedTags, ["gol-bra.1-123-1 x 0"]);
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
