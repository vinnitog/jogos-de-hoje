const STORAGE_KEY = "jogos-hoje-cache-v2";
const DATA_URL = "data/jogos.json";
const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const TIME_ZONE = "America/Sao_Paulo";
const WORLD_CUP_2026 = "Copa do Mundo 2026";
const WORLD_CUP_2026_DEFAULT_BROADCAST = {
  name: "CazéTV",
  type: "streaming",
  guaranteed: true,
  source: "manual"
};
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
    name: WORLD_CUP_2026,
    slug: "fifa.world"
  }
];
const COMPETITIONS = LEAGUES.map((league) => league.name);

const FALLBACK_DATA = {
  updatedAt: null,
  source: {
    label: "Sem dados offline",
    type: "offline"
  },
  games: []
};

const state = {
  data: FALLBACK_DATA,
  selectedDate: getTodayISO(),
  selectedCompetition: "Todos",
  query: ""
};

function getTodayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateISOInTimeZone(value, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function getTimeInTimeZone(value, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toEspnDate(dateISO) {
  return String(dateISO || getTodayISO()).replaceAll("-", "");
}

function buildScoreboardUrl(slug, dateISO) {
  const params = new URLSearchParams({
    dates: toEspnDate(dateISO),
    region: "br",
    lang: "pt"
  });

  return `${ESPN_API_BASE}/${slug}/scoreboard?${params.toString()}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sortGamesByTime(games) {
  return [...games].sort((a, b) => {
    const timeA = a.time || "99:99";
    const timeB = b.time || "99:99";
    return timeA.localeCompare(timeB) || a.home.localeCompare(b.home);
  });
}

function gameMatchesQuery(game, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchable = [
    game.home,
    game.away,
    game.venue,
    game.competition,
    ...(game.broadcasts || []).map(getBroadcastName)
  ].join(" ");

  return normalizeText(searchable).includes(normalizedQuery);
}

function getBroadcastName(broadcast) {
  if (typeof broadcast === "string") {
    return broadcast;
  }

  return broadcast?.name || "";
}

function normalizeBroadcast(broadcast, defaults = {}) {
  const name = getBroadcastName(broadcast).trim();

  if (!name) {
    return null;
  }

  return {
    name,
    type: broadcast?.type || defaults.type || "unknown",
    guaranteed: Boolean(broadcast?.guaranteed ?? defaults.guaranteed),
    source: broadcast?.source || defaults.source || "api"
  };
}

function getNormalizedBroadcasts(broadcasts = []) {
  return broadcasts.map((broadcast) => normalizeBroadcast(broadcast)).filter(Boolean);
}

function mergeBroadcasts(broadcasts) {
  const broadcastsByName = new Map();

  broadcasts.forEach((broadcast) => {
    const normalized = normalizeBroadcast(broadcast);

    if (!normalized) {
      return;
    }

    const key = normalizeText(normalized.name);
    const current = broadcastsByName.get(key);

    if (!current) {
      broadcastsByName.set(key, normalized);
      return;
    }

    broadcastsByName.set(key, {
      ...current,
      type: current.type !== "unknown" ? current.type : normalized.type,
      guaranteed: current.guaranteed || normalized.guaranteed,
      source: current.source === "api" ? current.source : normalized.source
    });
  });

  return [...broadcastsByName.values()];
}

function getDefaultBroadcastsForCompetition(competition) {
  if (competition === WORLD_CUP_2026) {
    return [WORLD_CUP_2026_DEFAULT_BROADCAST];
  }

  return [];
}

function enrichBroadcastsForCompetition(competition, broadcasts = []) {
  const sourceBroadcasts = broadcasts.map((broadcast) =>
    normalizeBroadcast(broadcast, { source: "espn" })
  );
  const defaultBroadcasts = getDefaultBroadcastsForCompetition(competition);

  return mergeBroadcasts([...sourceBroadcasts, ...defaultBroadcasts]);
}

function filterGames(games, filters) {
  const selectedDate = filters.selectedDate;
  const selectedCompetition = filters.selectedCompetition || "Todos";
  const query = filters.query || "";

  return sortGamesByTime(
    games.filter((game) => {
      const matchesDate = game.date === selectedDate;
      const matchesCompetition =
        selectedCompetition === "Todos" || game.competition === selectedCompetition;

      return matchesDate && matchesCompetition && gameMatchesQuery(game, query);
    })
  );
}

function summarizeGames(games) {
  return {
    total: games.length,
    live: games.filter((game) => game.status === "live").length,
    withBroadcast: games.filter((game) =>
      getNormalizedBroadcasts(game.broadcasts).length > 0
    ).length
  };
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function getStatusLabel(status) {
  const labels = {
    scheduled: "Programado",
    live: "Ao vivo",
    finished: "Encerrado",
    postponed: "Adiado"
  };

  return labels[status] || "Programado";
}

function getMatchDisplayValue(game) {
  if (["live", "finished"].includes(game.status) && game.score) {
    return game.score;
  }

  return game.time || "--:--";
}

function mapEspnStatus(statusType = {}) {
  const statusName = normalizeText(statusType.name);
  const description = normalizeText(statusType.description);

  if (statusName.includes("postponed") || description.includes("adiado")) {
    return "postponed";
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

function formatVenue(venue = {}) {
  const city = venue.address?.city;
  const country = venue.address?.country;
  const location = [city, country].filter(Boolean).join(", ");

  return [venue.fullName || venue.displayName, location].filter(Boolean).join(" - ");
}

function extractBroadcasts(competition = {}) {
  const broadcastNames = (competition.broadcasts || [])
    .flatMap((broadcast) => broadcast.names || [])
    .filter(Boolean);

  const geoBroadcastNames = (competition.geoBroadcasts || [])
    .filter((broadcast) => !broadcast.region || broadcast.region === "br")
    .map((broadcast) => broadcast.media?.shortName)
    .filter(Boolean);

  return [...new Set([...broadcastNames, ...geoBroadcastNames])];
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
  const score = homeScore != null && awayScore != null ? `${homeScore} x ${awayScore}` : "";

  return {
    id: `${league.slug}-${event.id}`,
    competition: league.name,
    stage: competition.altGameNote || event.season?.slug || league.name,
    date: getDateISOInTimeZone(kickoff),
    time: getTimeInTimeZone(kickoff),
    home: home.team?.displayName || home.team?.shortDisplayName || "Mandante",
    away: away.team?.displayName || away.team?.shortDisplayName || "Visitante",
    venue: formatVenue(competition.venue || event.venue),
    status,
    score,
    broadcasts: enrichBroadcastsForCompetition(league.name, extractBroadcasts(competition)),
    sourceUrl: event.links?.find((link) => link.rel?.includes("summary"))?.href || ""
  };
}

function mapEspnScoreboard(scoreboard, league) {
  return (scoreboard.events || []).map((event) => mapEspnEvent(event, league));
}

async function fetchLeagueGames(league, dateISO) {
  const response = await fetch(buildScoreboardUrl(league.slug, dateISO), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${league.name}: ${response.status}`);
  }

  return mapEspnScoreboard(await response.json(), league);
}

async function fetchRealGamesData(dateISO) {
  const results = await Promise.allSettled(
    LEAGUES.map((league) => fetchLeagueGames(league, dateISO))
  );
  const games = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failedRequests = results.filter((result) => result.status === "rejected").length;

  if (failedRequests === LEAGUES.length) {
    throw new Error("Nenhuma fonte real respondeu.");
  }

  return {
    updatedAt: new Date().toISOString(),
    source: {
      label: failedRequests > 0 ? "ESPN Brasil (parcial)" : "ESPN Brasil",
      type: "espn"
    },
    games
  };
}

function readCachedData(dateISO) {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return cached[dateISO] || null;
  } catch {
    return null;
  }
}

function cacheData(dateISO, data) {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    cached[dateISO] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Sem espaco ou modo privado: o app continua com os dados em memoria.
  }
}

async function loadLocalFallbackData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar fallback: ${response.status}`);
    }

    return response.json();
  } catch {
    return FALLBACK_DATA;
  }
}

async function loadGamesData(dateISO = state.selectedDate) {
  try {
    const data = await fetchRealGamesData(dateISO);
    cacheData(dateISO, data);
    return data;
  } catch {
    return readCachedData(dateISO) || loadLocalFallbackData();
  }
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
}

function createBroadcastChip(channel) {
  const broadcast = normalizeBroadcast(channel);
  const chip = document.createElement("span");
  chip.className = "broadcast-chip";
  chip.textContent = broadcast.name;
  chip.classList.toggle("is-guaranteed", broadcast.guaranteed);
  chip.dataset.type = broadcast.type;
  chip.title = broadcast.guaranteed
    ? `${broadcast.name} - transmissão confirmada para esta competição`
    : `${broadcast.name} - informado pela fonte`;
  return chip;
}

function renderCompetitionTabs() {
  const container = document.querySelector("#competition-filter");
  if (!container) {
    return;
  }

  container.textContent = "";
  ["Todos", ...COMPETITIONS].forEach((competition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.role = "tab";
    button.textContent = competition;
    button.setAttribute("aria-selected", String(competition === state.selectedCompetition));
    button.addEventListener("click", () => {
      state.selectedCompetition = competition;
      renderApp();
    });
    container.append(button);
  });
}

function renderGameCard(game) {
  const template = document.querySelector("#game-card-template");
  const card = template.content.firstElementChild.cloneNode(true);
  const status = card.querySelector(".status");
  const broadcasts = card.querySelector(".broadcasts");
  const gameBroadcasts = getNormalizedBroadcasts(game.broadcasts);

  card.querySelector(".competition").textContent = game.competition;
  status.textContent = getStatusLabel(game.status);
  status.classList.toggle("is-live", game.status === "live");
  status.classList.toggle("is-finished", game.status === "finished");
  card.querySelector(".home-team").textContent = game.home;
  card.querySelector(".away-team").textContent = game.away;
  card.querySelector(".score-time").textContent = getMatchDisplayValue(game);
  card.querySelector(".stage").textContent = game.stage || "--";
  card.querySelector(".venue").textContent = game.venue || "--";

  broadcasts.textContent = "";
  if (gameBroadcasts.length === 0) {
    broadcasts.textContent = "A confirmar pela fonte";
  } else {
    gameBroadcasts.forEach((channel) => broadcasts.append(createBroadcastChip(channel)));
  }

  return card;
}

function renderGames(games) {
  const list = document.querySelector("#game-list");
  const empty = document.querySelector("#empty-state");
  if (!list || !empty) {
    return;
  }

  list.textContent = "";
  games.forEach((game) => list.append(renderGameCard(game)));
  empty.hidden = games.length > 0;
}

function renderSummary(games) {
  const summary = summarizeGames(games);
  const totalLabel = summary.total === 1 ? "1 jogo" : `${summary.total} jogos`;

  setText("#summary-title", totalLabel);
  setText("#summary-live", String(summary.live));
  setText("#summary-tv", String(summary.withBroadcast));
}

function renderConnectionStatus() {
  const element = document.querySelector("#connection-status");
  if (!element) {
    return;
  }

  const isOnline = navigator.onLine;
  element.textContent = isOnline ? "Online" : "Offline";
  element.classList.toggle("is-offline", !isOnline);
}

function renderApp() {
  renderCompetitionTabs();
  const filteredGames = filterGames(state.data.games || [], state);
  renderGames(filteredGames);
  renderSummary(filteredGames);
  renderConnectionStatus();
  setText("#updated-at", formatDateTime(state.data.updatedAt));
  setText("#source-label", state.data.source?.label || "Fonte não informada");
}

async function refreshData() {
  const button = document.querySelector("#refresh-button");
  button?.classList.add("is-loading");
  state.data = await loadGamesData();
  button?.classList.remove("is-loading");
  renderApp();
}

function bindEvents() {
  const dateFilter = document.querySelector("#date-filter");
  const searchFilter = document.querySelector("#search-filter");
  const refreshButton = document.querySelector("#refresh-button");

  if (dateFilter) {
    dateFilter.value = state.selectedDate;
    dateFilter.addEventListener("change", async () => {
      state.selectedDate = dateFilter.value || getTodayISO();
      await refreshData();
    });
  }

  if (searchFilter) {
    searchFilter.addEventListener("input", () => {
      state.query = searchFilter.value;
      renderApp();
    });
  }

  refreshButton?.addEventListener("click", refreshData);
  window.addEventListener("online", renderConnectionStatus);
  window.addEventListener("offline", renderConnectionStatus);
}

async function initApp() {
  bindEvents();
  renderApp();
  await refreshData();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    COMPETITIONS,
    FALLBACK_DATA,
    LEAGUES,
    buildScoreboardUrl,
    filterGames,
    gameMatchesQuery,
    getMatchDisplayValue,
    getStatusLabel,
    mapEspnEvent,
    mapEspnScoreboard,
    getTodayISO,
    enrichBroadcastsForCompetition,
    getBroadcastName,
    getNormalizedBroadcasts,
    normalizeText,
    normalizeBroadcast,
    sortGamesByTime,
    summarizeGames
  };
}
