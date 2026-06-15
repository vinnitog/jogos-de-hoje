const STORAGE_KEY = "jogos-hoje-cache-v1";
const DATA_URL = "data/jogos.json";
const COMPETITIONS = [
  "Brasileirão Série A",
  "Paulista Série A1",
  "Libertadores",
  "Copa do Brasil"
];

const FALLBACK_DATA = {
  updatedAt: "2026-06-15T16:26:00-03:00",
  source: {
    label: "Dados demonstrativos",
    type: "sample"
  },
  games: [
    {
      id: "demo-bra-001",
      competition: "Brasileirão Série A",
      stage: "Rodada",
      date: "2026-06-15",
      time: "19:00",
      home: "Palmeiras",
      away: "Flamengo",
      venue: "Allianz Parque, São Paulo",
      status: "scheduled",
      broadcasts: ["Globo", "Premiere"]
    },
    {
      id: "demo-cdb-001",
      competition: "Copa do Brasil",
      stage: "Oitavas de final",
      date: "2026-06-15",
      time: "21:30",
      home: "Cruzeiro",
      away: "Athletico-PR",
      venue: "Mineirão, Belo Horizonte",
      status: "scheduled",
      broadcasts: ["SporTV", "Premiere"]
    },
    {
      id: "demo-lib-001",
      competition: "Libertadores",
      stage: "Grupo",
      date: "2026-06-15",
      time: "21:00",
      home: "São Paulo",
      away: "Nacional",
      venue: "Morumbis, São Paulo",
      status: "live",
      broadcasts: ["ESPN", "Disney+"]
    },
    {
      id: "demo-pau-001",
      competition: "Paulista Série A1",
      stage: "Primeira fase",
      date: "2026-06-16",
      time: "20:00",
      home: "Santos",
      away: "Ponte Preta",
      venue: "Vila Belmiro, Santos",
      status: "scheduled",
      broadcasts: ["Record", "Paulistão Play"]
    }
  ]
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
    ...(game.broadcasts || [])
  ].join(" ");

  return normalizeText(searchable).includes(normalizedQuery);
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
    withBroadcast: games.filter((game) => (game.broadcasts || []).length > 0).length
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

function readCachedData() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function cacheData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Sem espaço ou modo privado: o app continua com os dados em memória.
  }
}

async function loadGamesData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar dados: ${response.status}`);
    }

    const data = await response.json();
    cacheData(data);
    return data;
  } catch {
    return readCachedData() || FALLBACK_DATA;
  }
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
}

function createBroadcastChip(channel) {
  const chip = document.createElement("span");
  chip.className = "broadcast-chip";
  chip.textContent = channel;
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

  card.querySelector(".competition").textContent = game.competition;
  status.textContent = getStatusLabel(game.status);
  status.classList.toggle("is-live", game.status === "live");
  status.classList.toggle("is-finished", game.status === "finished");
  card.querySelector(".home-team").textContent = game.home;
  card.querySelector(".away-team").textContent = game.away;
  card.querySelector(".score-time").textContent = game.time || "--:--";
  card.querySelector(".stage").textContent = game.stage || "--";
  card.querySelector(".venue").textContent = game.venue || "--";

  broadcasts.textContent = "";
  if ((game.broadcasts || []).length === 0) {
    broadcasts.textContent = "A confirmar";
  } else {
    game.broadcasts.forEach((channel) => broadcasts.append(createBroadcastChip(channel)));
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
    dateFilter.addEventListener("change", () => {
      state.selectedDate = dateFilter.value || getTodayISO();
      renderApp();
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
    filterGames,
    gameMatchesQuery,
    getStatusLabel,
    getTodayISO,
    normalizeText,
    sortGamesByTime,
    summarizeGames
  };
}
