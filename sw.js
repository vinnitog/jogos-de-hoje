const CACHE_NAME = "jogos-hoje-v7";
const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const TIME_ZONE = "America/Sao_Paulo";
const GOAL_BACKGROUND_SYNC_TAG = "goal-notifications-live";
const GOAL_STATE_CACHE_KEY = "https://jogos-hoje.local/goal-notification-state";
const GOAL_NOTIFIED_TAG_LIMIT = 80;
const LIVE_SCORE_STATUSES = ["live", "halftime", "finished"];
const APP_SHELL = [
  ".",
  "index.html",
  "css/app.css",
  "js/app.js",
  "data/jogos.json",
  "manifest.json",
  "icons/icon.svg"
];
const LEAGUES = [
  {
    name: "Brasileirão Série A",
    slug: "bra.1"
  },
  {
    name: "Paulista Série A1",
    slug: "bra.camp.paulista"
  },
  {
    name: "Libertadores",
    slug: "conmebol.libertadores"
  },
  {
    name: "Copa do Brasil",
    slug: "bra.copa_do_brazil"
  },
  {
    name: "Copa do Mundo 2026",
    slug: "fifa.world"
  }
];

function getGoalStateFallback() {
  return {
    enabled: false,
    games: [],
    dateISO: null,
    notifiedTags: []
  };
}

async function readGoalNotificationState() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(GOAL_STATE_CACHE_KEY);
    if (!response) {
      return getGoalStateFallback();
    }

    const state = await response.json();
    return {
      ...getGoalStateFallback(),
      ...state,
      games: Array.isArray(state.games) ? state.games : [],
      notifiedTags: Array.isArray(state.notifiedTags) ? state.notifiedTags : []
    };
  } catch {
    return getGoalStateFallback();
  }
}

async function writeGoalNotificationState(state) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      GOAL_STATE_CACHE_KEY,
      new Response(JSON.stringify(state), {
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
  } catch {
    // If storage is unavailable, the next foreground refresh still handles alerts.
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getTodayISOInTimeZone(date = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function getDateISOInTimeZone(value, timeZone = TIME_ZONE) {
  return getTodayISOInTimeZone(new Date(value), timeZone);
}

function toEspnDate(dateISO) {
  return String(dateISO || getTodayISOInTimeZone()).replaceAll("-", "");
}

function buildScoreboardUrl(slug, dateISO) {
  const params = new URLSearchParams({
    dates: toEspnDate(dateISO),
    region: "br",
    lang: "pt"
  });

  return `${ESPN_API_BASE}/${slug}/scoreboard?${params.toString()}`;
}

function mapEspnStatus(statusType = {}) {
  const statusName = normalizeText(statusType.name);
  const description = normalizeText(statusType.description);

  if (statusName.includes("postponed") || description.includes("adiado")) {
    return "postponed";
  }

  if (
    statusName.includes("halftime") ||
    statusName.includes("half_time") ||
    statusName.includes("half-time") ||
    description.includes("intervalo") ||
    description.includes("half time") ||
    description.includes("half-time")
  ) {
    return "halftime";
  }

  if (statusType.state === "in") {
    return "live";
  }

  if (statusType.completed || statusType.state === "post") {
    return "finished";
  }

  return "scheduled";
}

function findCompetitor(competitors = [], homeAway) {
  return competitors.find((competitor) => competitor.homeAway === homeAway) || null;
}

function mapEspnEvent(event, league) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = findCompetitor(competitors, "home") || competitors[0] || {};
  const away = findCompetitor(competitors, "away") || competitors[1] || {};
  const status = mapEspnStatus(competition.status?.type || event.status?.type || {});
  const kickoff = competition.date || event.date;
  const homeScore = home.score;
  const awayScore = away.score;

  return {
    id: `${league.slug}-${event.id}`,
    competition: league.name,
    date: getDateISOInTimeZone(kickoff),
    home: home.team?.displayName || home.team?.shortDisplayName || "Mandante",
    away: away.team?.displayName || away.team?.shortDisplayName || "Visitante",
    status,
    score: homeScore != null && awayScore != null ? `${homeScore} x ${awayScore}` : ""
  };
}

async function fetchLeagueGames(league, dateISO) {
  const response = await fetch(buildScoreboardUrl(league.slug, dateISO), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${league.name}: ${response.status}`);
  }

  const scoreboard = await response.json();
  return (scoreboard.events || []).map((event) => mapEspnEvent(event, league));
}

async function fetchTodayGames(dateISO) {
  const results = await Promise.allSettled(
    LEAGUES.map((league) => fetchLeagueGames(league, dateISO))
  );
  const fulfilled = results.filter((result) => result.status === "fulfilled");

  if (fulfilled.length === 0) {
    throw new Error("All scoreboard requests failed.");
  }

  return fulfilled.flatMap((result) => result.value);
}

function parseScore(score) {
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(String(score || "").trim());

  if (!match) {
    return null;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  return {
    home,
    away,
    total: home + away
  };
}

function getGoalNotificationGameKey(game = {}) {
  if (game.id) {
    return String(game.id);
  }

  return [
    game.date,
    game.competition,
    normalizeText(game.home),
    normalizeText(game.away)
  ].join("|");
}

function createGoalEvent(previousGame, nextGame) {
  const previousScore = parseScore(previousGame?.score) || { home: 0, away: 0, total: 0 };
  const nextScore = parseScore(nextGame?.score);

  if (
    !nextScore ||
    nextScore.total <= previousScore.total ||
    nextScore.home < previousScore.home ||
    nextScore.away < previousScore.away
  ) {
    return null;
  }

  const homeDelta = Math.max(0, nextScore.home - previousScore.home);
  const awayDelta = Math.max(0, nextScore.away - previousScore.away);
  const goalCount = homeDelta + awayDelta;

  if (goalCount === 0) {
    return null;
  }

  const scoringTeams = [];
  if (homeDelta > 0) {
    scoringTeams.push(nextGame.home);
  }
  if (awayDelta > 0) {
    scoringTeams.push(nextGame.away);
  }

  return {
    id: getGoalNotificationGameKey(nextGame),
    title:
      scoringTeams.length === 1
        ? `${goalCount > 1 ? "Gols do" : "Gol do"} ${scoringTeams[0]}!`
        : "Gols na partida!",
    body: `${nextGame.competition}: ${nextGame.home} ${nextGame.score} ${nextGame.away}`,
    score: nextGame.score
  };
}

function detectGoalEvents(previousGames = [], nextGames = []) {
  const previousByGame = new Map(
    previousGames.map((game) => [getGoalNotificationGameKey(game), game])
  );

  return nextGames
    .map((game) => {
      const previousGame = previousByGame.get(getGoalNotificationGameKey(game));

      if (!previousGame || !LIVE_SCORE_STATUSES.includes(game.status)) {
        return null;
      }

      return createGoalEvent(previousGame, game);
    })
    .filter(Boolean);
}

function getGoalNotificationTag(goalEvent) {
  return `gol-${goalEvent.id}-${goalEvent.score}`;
}

async function showTrackedGoalNotification(goalEvent, state) {
  const tag = getGoalNotificationTag(goalEvent);
  if (state.notifiedTags.includes(tag)) {
    return;
  }

  await self.registration.showNotification(goalEvent.title, {
    body: goalEvent.body,
    tag,
    renotify: true,
    icon: "icons/icon.svg",
    badge: "icons/icon.svg",
    data: {
      url: "."
    }
  });

  state.notifiedTags = [...state.notifiedTags, tag].slice(-GOAL_NOTIFIED_TAG_LIMIT);
}

async function syncGoalNotifications() {
  const state = await readGoalNotificationState();
  if (!state.enabled) {
    return;
  }

  const dateISO = getTodayISOInTimeZone();
  let nextGames = [];

  try {
    nextGames = await fetchTodayGames(dateISO);
  } catch {
    return;
  }

  const goalEvents = detectGoalEvents(state.games, nextGames);

  for (const goalEvent of goalEvents) {
    await showTrackedGoalNotification(goalEvent, state);
  }

  await writeGoalNotificationState({
    ...state,
    games: nextGames,
    dateISO,
    updatedAt: new Date().toISOString()
  });
}

async function updateGoalNotificationStateFromClient(data = {}) {
  const state = await readGoalNotificationState();
  const hasGamesSnapshot = Array.isArray(data.games);
  const nextState = {
    ...state,
    enabled: Boolean(data.enabled),
    updatedAt: new Date().toISOString()
  };

  if (hasGamesSnapshot) {
    nextState.games = data.games;
    nextState.dateISO = data.dateISO || getTodayISOInTimeZone();
  }

  await writeGoalNotificationState(nextState);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("index.html")));
    return;
  }

  if (request.url.includes("/data/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.url.includes("site.api.espn.com/apis/site/v2/sports/soccer")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "goal-notifications-state") {
    event.waitUntil(
      updateGoalNotificationStateFromClient(event.data).then(() => {
        event.ports?.[0]?.postMessage({ ok: true });
      })
    );
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === GOAL_BACKGROUND_SYNC_TAG) {
    event.waitUntil(syncGoalNotifications());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === GOAL_BACKGROUND_SYNC_TAG) {
    event.waitUntil(syncGoalNotifications());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || ".");
      }

      return undefined;
    })
  );
});
