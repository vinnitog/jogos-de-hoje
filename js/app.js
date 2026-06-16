const STORAGE_KEY = "jogos-hoje-cache-v2";
const GOAL_NOTIFICATIONS_STORAGE_KEY = "jogos-hoje-goal-notifications";
const WHATSAPP_CONTACT_STORAGE_KEY = "jogos-hoje-whatsapp-contact";
const WHATSAPP_DEFAULT_CONTACT_ID = "primary";
const GOAL_BACKGROUND_SYNC_TAG = "goal-notifications-live";
const DATA_URL = "data/jogos.json";
const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const TIME_ZONE = "America/Sao_Paulo";
const AUTO_REFRESH_INTERVALS = {
  live: 90_000,
  today: 240_000,
  otherDate: 900_000,
  minManual: 30_000
};
const NOTIFICATION_SERVICE_WORKER_TIMEOUT = 1500;
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WORLD_CUP_2026 = "Copa do Mundo 2026";
const WORLD_CUP_2026_DEFAULT_BROADCAST = {
  name: "CazéTV",
  type: "streaming",
  guaranteed: true,
  source: "manual"
};
// Transmissoes habituais por competicao no Brasil. A ESPN nao retorna canais
// para a regiao "br", entao este mapa curado complementa a lista quando a fonte
// nao traz nada. Sao marcadas como source "manual" (habitual da competicao),
// nao confirmadas por jogo, exceto a CazeTV na Copa do Mundo (guaranteed).
const LEAGUE_DEFAULT_BROADCASTS = {
  "Brasileirão Série A": [
    { name: "Premiere", type: "ppv", source: "manual" },
    { name: "Globo", type: "tv", source: "manual" },
    { name: "CazéTV", type: "streaming", source: "manual" }
  ],
  "Paulista Série A1": [
    { name: "CazéTV", type: "streaming", source: "manual" },
    { name: "Record", type: "tv", source: "manual" },
    { name: "Paulistão Play", type: "streaming", source: "manual" }
  ],
  Libertadores: [
    { name: "Paramount+", type: "streaming", source: "manual" },
    { name: "SBT", type: "tv", source: "manual" },
    { name: "ESPN", type: "tv", source: "manual" }
  ],
  "Copa do Brasil": [
    { name: "Prime Video", type: "streaming", source: "manual" },
    { name: "Globo", type: "tv", source: "manual" },
    { name: "SporTV", type: "tv", source: "manual" }
  ],
  [WORLD_CUP_2026]: [WORLD_CUP_2026_DEFAULT_BROADCAST]
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
const WHATSAPP_PRESET_CONTACTS = [
  {
    id: WHATSAPP_DEFAULT_CONTACT_ID,
    label: "Contato padrao",
    sealedDigits: [70, 71, 68, 72, 78, 73, 67, 73, 74, 74, 67, 69, 73]
  }
];

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
  calendarMonthDate: getTodayISO(),
  selectedCompetition: "Todos",
  query: "",
  whatsAppPhone: readWhatsAppPhonePreference(),
  selectedWhatsAppPresetContactId: "",
  goalNotificationsEnabled: readGoalNotificationsPreference()
};

const refreshRuntime = {
  timerId: null,
  inFlight: false,
  lastStartedAt: 0,
  pendingOptions: null
};

function getTodayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateISO(dateISO) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ""));

  if (!match) {
    return parseDateISO(getTodayISO());
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateISO(dateISO, days) {
  const date = parseDateISO(dateISO);
  date.setDate(date.getDate() + days);
  return toDateISO(date);
}

function getMonthStartISO(dateISO) {
  const date = parseDateISO(dateISO);
  return toDateISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

function capitalizeFirst(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function formatDateDisplayParts(dateISO, todayISO = getTodayISO()) {
  const date = parseDateISO(dateISO);
  const dateLabel = new Intl.DateTimeFormat("pt-BR").format(date);
  let dayLabel = capitalizeFirst(
    new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date)
  );

  if (dateISO === todayISO) {
    dayLabel = "Hoje";
  } else if (dateISO === shiftDateISO(todayISO, -1)) {
    dayLabel = "Ontem";
  } else if (dateISO === shiftDateISO(todayISO, 1)) {
    dayLabel = "Amanhã";
  }

  return {
    dayLabel,
    dateLabel
  };
}

function getCalendarDays(monthDateISO, selectedDateISO, todayISO = getTodayISO()) {
  const monthDate = parseDateISO(monthDateISO);
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = toDateISO(date);

    return {
      iso,
      day: date.getDate(),
      currentMonth: date.getMonth() === monthDate.getMonth(),
      selected: iso === selectedDateISO,
      today: iso === todayISO,
      weekday: WEEKDAY_LABELS[date.getDay()]
    };
  });
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

function readGoalNotificationsPreference() {
  try {
    return localStorage.getItem(GOAL_NOTIFICATIONS_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function saveGoalNotificationsPreference(enabled) {
  try {
    localStorage.setItem(GOAL_NOTIFICATIONS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Preferencia em memoria apenas; navegadores privados podem bloquear storage.
  }
}

function readWhatsAppPhonePreference() {
  try {
    return localStorage.getItem(WHATSAPP_CONTACT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveWhatsAppPhonePreference(phone) {
  try {
    if (phone) {
      localStorage.setItem(WHATSAPP_CONTACT_STORAGE_KEY, phone);
    } else {
      localStorage.removeItem(WHATSAPP_CONTACT_STORAGE_KEY);
    }
  } catch {
    // Preferencia em memoria apenas; navegadores privados podem bloquear storage.
  }
}

function normalizeWhatsAppPhone(value, defaultCountryCode = "55") {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `${defaultCountryCode}${digits}`;
  }

  return "";
}

function formatBrazilPhoneMask(localDigits, prefix = "") {
  const digits = String(localDigits || "").slice(0, 11);

  if (digits.length === 0) {
    return prefix.trim();
  }

  const ddd = digits.slice(0, 2);

  if (digits.length <= 2) {
    return `${prefix}(${ddd}`;
  }

  const rest = digits.slice(2);
  let formattedRest;

  if (rest.length <= 4) {
    formattedRest = rest;
  } else if (rest.length <= 8) {
    formattedRest = `${rest.slice(0, 4)}-${rest.slice(4)}`;
  } else {
    formattedRest = `${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  return `${prefix}(${ddd}) ${formattedRest}`;
}

function formatWhatsAppPhoneInput(value) {
  const raw = String(value || "");
  const hadInternational = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("55") && digits.length > 2) {
    return formatBrazilPhoneMask(digits.slice(2), "+55 ");
  }

  if (!hadInternational && digits.length <= 11) {
    return formatBrazilPhoneMask(digits);
  }

  return `+${digits}`;
}

function unsealContactDigits(sealedDigits = []) {
  return sealedDigits
    .map((value, index) => String.fromCharCode(value - 17 - (index % 5)))
    .join("");
}

function getWhatsAppPresetContact(contactId = WHATSAPP_DEFAULT_CONTACT_ID) {
  const preset = WHATSAPP_PRESET_CONTACTS.find((contact) => contact.id === contactId);

  if (!preset) {
    return null;
  }

  return {
    id: preset.id,
    label: preset.label,
    phone: unsealContactDigits(preset.sealedDigits)
  };
}

function getSelectedWhatsAppPhone(inputValue) {
  const preset = state.selectedWhatsAppPresetContactId
    ? getWhatsAppPresetContact(state.selectedWhatsAppPresetContactId)
    : null;

  return preset?.phone || normalizeWhatsAppPhone(inputValue || state.whatsAppPhone);
}

function isGoalNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function areGoalNotificationsActive() {
  return (
    state.goalNotificationsEnabled &&
    isGoalNotificationSupported() &&
    Notification.permission === "granted"
  );
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const timeoutPromise = new Promise((resolve) => {
      window.setTimeout(() => resolve(null), NOTIFICATION_SERVICE_WORKER_TIMEOUT);
    });
    return await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
  } catch {
    return null;
  }
}

async function registerAppServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    await navigator.serviceWorker.register("sw.js");
    return getServiceWorkerRegistration();
  } catch {
    return null;
  }
}

function postGoalNotificationStateToServiceWorker(
  games = state.data.games || [],
  dateISO = state.selectedDate,
  options = {}
) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(false);
  }

  const sendState = (registration) => {
    const worker = registration?.active || navigator.serviceWorker.controller;
    if (!worker) {
      return false;
    }

    const todayISO = getTodayISO();
    const includeSnapshot = options.includeSnapshot ?? dateISO === todayISO;
    const payload = {
      type: "goal-notifications-state",
      enabled: areGoalNotificationsActive()
    };

    if (includeSnapshot) {
      payload.games = games;
      payload.dateISO = dateISO || todayISO;
    }

    if (typeof MessageChannel === "undefined") {
      worker.postMessage(payload);
      return true;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeoutId = window.setTimeout(() => resolve(false), NOTIFICATION_SERVICE_WORKER_TIMEOUT);

      channel.port1.onmessage = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };

      worker.postMessage(payload, [channel.port2]);
    });
  };

  return getServiceWorkerRegistration().then(sendState);
}

async function syncTodayGoalNotificationSnapshot() {
  const todayISO = getTodayISO();

  if (state.selectedDate === todayISO) {
    return postGoalNotificationStateToServiceWorker(state.data.games || [], todayISO, {
      includeSnapshot: true
    });
  }

  const todayData = readCachedData(todayISO) || (await loadGamesData(todayISO));
  return postGoalNotificationStateToServiceWorker(todayData.games || [], todayISO, {
    includeSnapshot: true
  });
}

async function registerGoalBackgroundSync() {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return false;
  }

  try {
    if ("periodicSync" in registration) {
      let permission = null;
      try {
        permission =
          navigator.permissions && typeof navigator.permissions.query === "function"
            ? await navigator.permissions.query({ name: "periodic-background-sync" })
            : null;
      } catch {
        permission = null;
      }

      try {
        if (!permission || permission.state !== "denied") {
          await registration.periodicSync.register(GOAL_BACKGROUND_SYNC_TAG, {
            minInterval: AUTO_REFRESH_INTERVALS.live
          });
          return true;
        }
      } catch {
        // Periodic Sync e opcional; sem ele o app mantem notificacoes em foreground.
      }
    }
  } catch {
    return false;
  }

  return false;
}

async function unregisterGoalBackgroundSync() {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return;
  }

  try {
    if ("periodicSync" in registration) {
      await registration.periodicSync.unregister(GOAL_BACKGROUND_SYNC_TAG);
    }
  } catch {
    // Navegadores sem suporte total apenas mantem a notificacao em foreground.
  }
}

async function setGoalNotificationsEnabled(shouldEnable) {
  if (!shouldEnable) {
    state.goalNotificationsEnabled = false;
    saveGoalNotificationsPreference(false);
    await unregisterGoalBackgroundSync();
    await postGoalNotificationStateToServiceWorker([], getTodayISO(), {
      includeSnapshot: true
    });
    renderGoalNotificationToggle();
    return;
  }

  if (!isGoalNotificationSupported()) {
    state.goalNotificationsEnabled = false;
    saveGoalNotificationsPreference(false);
    renderGoalNotificationToggle();
    return;
  }

  let permission = Notification.permission;

  try {
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
  } catch {
    permission = "denied";
  }

  state.goalNotificationsEnabled = permission === "granted";
  saveGoalNotificationsPreference(state.goalNotificationsEnabled);

  if (state.goalNotificationsEnabled) {
    await syncTodayGoalNotificationSnapshot();
    registerGoalBackgroundSync().then(() => renderGoalNotificationToggle());
  } else {
    await postGoalNotificationStateToServiceWorker([], getTodayISO(), {
      includeSnapshot: true
    });
  }

  renderGoalNotificationToggle();
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

  const title =
    scoringTeams.length === 1
      ? `${goalCount > 1 ? "Gols do" : "Gol do"} ${scoringTeams[0]}!`
      : "Gols na partida!";

  return {
    id: getGoalNotificationGameKey(nextGame),
    title,
    body: `${nextGame.competition}: ${nextGame.home} ${nextGame.score} ${nextGame.away}`,
    score: nextGame.score,
    goalCount,
    scoringTeams
  };
}

function detectGoalEvents(previousGames = [], nextGames = []) {
  const previousByGame = new Map(
    previousGames.map((game) => [getGoalNotificationGameKey(game), game])
  );

  return nextGames
    .map((game) => {
      const previousGame = previousByGame.get(getGoalNotificationGameKey(game));

      if (!previousGame || !["live", "halftime", "finished"].includes(game.status)) {
        return null;
      }

      return createGoalEvent(previousGame, game);
    })
    .filter(Boolean);
}

function getGoalNotificationStatusText() {
  if (!isGoalNotificationSupported()) {
    return "Gols: indisponivel";
  }

  if (Notification.permission === "denied") {
    return "Gols: bloqueado";
  }

  if (areGoalNotificationsActive()) {
    return "Gols: ligado";
  }

  return "Gols: desligado";
}

function renderGoalNotificationToggle() {
  const toggle = document.querySelector("#goal-notifications-toggle");
  const status = document.querySelector("#goal-notification-status");
  const control = document.querySelector("#goal-notification-control");

  if (!toggle || !status) {
    return;
  }

  const supported = isGoalNotificationSupported();
  const blocked = supported && Notification.permission === "denied";
  const active = areGoalNotificationsActive();

  toggle.checked = active;
  toggle.disabled = !supported || blocked;
  status.textContent = getGoalNotificationStatusText();
  control?.classList.toggle("is-on", active);
  control?.classList.toggle("is-blocked", blocked);
  control?.classList.toggle("is-disabled", !supported);
}

function createBrowserNotification(title, options) {
  try {
    return new Notification(title, options);
  } catch {
    return null;
  }
}

async function showServiceWorkerNotification(title, options) {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registrationPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((resolve) => {
      window.setTimeout(() => resolve(null), NOTIFICATION_SERVICE_WORKER_TIMEOUT);
    });
    const registration = await Promise.race([registrationPromise, timeoutPromise]);

    if (registration && typeof registration.showNotification === "function") {
      await registration.showNotification(title, options);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function showGoalNotification(goalEvent) {
  if (!areGoalNotificationsActive()) {
    return;
  }

  const options = {
    body: goalEvent.body,
    tag: `gol-${goalEvent.id}-${goalEvent.score}`,
    renotify: true,
    icon: "icons/icon.svg",
    badge: "icons/icon.svg",
    data: {
      url: "."
    }
  };

  try {
    if ("serviceWorker" in navigator) {
      showServiceWorkerNotification(goalEvent.title, options).then((shown) => {
        if (!shown) {
          createBrowserNotification(goalEvent.title, options);
        }
      });
      return;
    }

    createBrowserNotification(goalEvent.title, options);
  } catch {
    // A permissao pode mudar entre o toggle e o disparo; neste caso apenas ignora.
  }
}

function notifyGoalEvents(previousGames, nextGames) {
  if (!areGoalNotificationsActive()) {
    return;
  }

  detectGoalEvents(previousGames, nextGames).forEach(showGoalNotification);
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
  return LEAGUE_DEFAULT_BROADCASTS[competition] || [];
}

function enrichBroadcastsForCompetition(competition, broadcasts = []) {
  const sourceBroadcasts = broadcasts
    .map((broadcast) => normalizeBroadcast(broadcast, { source: "espn" }))
    .filter(Boolean);
  const defaultBroadcasts = getDefaultBroadcastsForCompetition(competition);
  const guaranteedDefaults = defaultBroadcasts.filter((broadcast) => broadcast.guaranteed);
  // Transmissoes garantidas (ex.: CazeTV na Copa do Mundo) entram sempre.
  // As habituais por liga so complementam quando a fonte nao trouxe canais,
  // para nao misturar palpite de liga com dado preciso por jogo.
  const habitualDefaults =
    sourceBroadcasts.length > 0
      ? []
      : defaultBroadcasts.filter((broadcast) => !broadcast.guaranteed);

  return mergeBroadcasts([...sourceBroadcasts, ...guaranteedDefaults, ...habitualDefaults]);
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
    live: games.filter((game) => isGameInProgress(game.status)).length,
    withBroadcast: games.filter((game) =>
      getNormalizedBroadcasts(game.broadcasts).length > 0
    ).length
  };
}

function formatBroadcastsForShare(broadcasts = []) {
  const names = getNormalizedBroadcasts(broadcasts).map(getBroadcastName);
  return names.length > 0 ? names.join(", ") : "A confirmar pela fonte";
}

function formatGameForShare(game) {
  const statusLabel = getStatusLabel(game.status);
  const matchDisplay = getMatchDisplayValue(game);
  const isScore = hasScoreDisplay(game.status) && Boolean(game.score);
  const statusSuffix = game.status && game.status !== "scheduled" ? ` (${statusLabel})` : "";
  const mainLine = isScore
    ? `${game.home} ${matchDisplay} ${game.away}${statusSuffix}`
    : `${matchDisplay} - ${game.home} x ${game.away}${statusSuffix}`;
  const details = [`Onde assistir: ${formatBroadcastsForShare(game.broadcasts)}`];

  if (game.venue) {
    details.push(`Local: ${game.venue}`);
  }

  return [`- ${mainLine}`, ...details.map((detail) => `  ${detail}`)].join("\n");
}

function groupGamesByCompetition(games) {
  return sortGamesByTime(games).reduce((groups, game) => {
    if (!groups.has(game.competition)) {
      groups.set(game.competition, []);
    }

    groups.get(game.competition).push(game);
    return groups;
  }, new Map());
}

function formatGamesShareMessage(games = [], options = {}) {
  const dateISO = options.dateISO || games[0]?.date || getTodayISO();
  const dateLabel = formatDateDisplayParts(dateISO).dateLabel;
  const lines = [`Agenda dos jogos - ${dateLabel}`, ""];

  if (games.length === 0) {
    lines.push("Nenhum jogo encontrado para os filtros atuais.");
  } else {
    groupGamesByCompetition(games).forEach((competitionGames, competition) => {
      lines.push(competition);
      lines.push(...competitionGames.map(formatGameForShare));
      lines.push("");
    });
  }

  if (options.sourceLabel) {
    lines.push(`Fonte: ${options.sourceLabel}`);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message || "")}`;
}

function hasLiveGamesOnDate(games, dateISO) {
  return games.some((game) => game.date === dateISO && isGameInProgress(game.status));
}

function getAutoRefreshInterval(dateISO, games, todayISO = getTodayISO()) {
  if (hasLiveGamesOnDate(games, dateISO)) {
    return AUTO_REFRESH_INTERVALS.live;
  }

  if (dateISO === todayISO) {
    return AUTO_REFRESH_INTERVALS.today;
  }

  return AUTO_REFRESH_INTERVALS.otherDate;
}

function formatRefreshInterval(milliseconds) {
  if (milliseconds < 120_000) {
    return `${Math.round(milliseconds / 1000)}s`;
  }

  return `${Math.round(milliseconds / 60_000)} min`;
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
    halftime: "Intervalo",
    finished: "Encerrado",
    postponed: "Adiado"
  };

  return labels[status] || "Programado";
}

function isGameInProgress(status) {
  return ["live", "halftime"].includes(status);
}

function hasScoreDisplay(status) {
  return ["live", "halftime", "finished"].includes(status);
}

function getMatchDisplayValue(game) {
  if (hasScoreDisplay(game.status) && game.score) {
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

function setDatePopoverOpen(isOpen) {
  const popover = document.querySelector("#date-popover");
  const display = document.querySelector("#date-display");

  if (!popover || !display) {
    return;
  }

  popover.hidden = !isOpen;
  display.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    renderCalendar();
  }
}

function renderDatePicker() {
  const display = document.querySelector("#date-display");
  const parts = formatDateDisplayParts(state.selectedDate);

  setText("#date-display-day", parts.dayLabel);
  setText("#date-display-date", parts.dateLabel);

  if (display) {
    display.setAttribute("aria-label", `Data selecionada: ${parts.dayLabel}, ${parts.dateLabel}`);
  }

  renderCalendar();
}

function renderCalendar() {
  const grid = document.querySelector("#calendar-grid");
  const monthLabel = document.querySelector("#calendar-month-label");

  if (!grid || !monthLabel) {
    return;
  }

  const monthDate = parseDateISO(state.calendarMonthDate);
  monthLabel.textContent = capitalizeFirst(
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate)
  );
  grid.textContent = "";

  getCalendarDays(state.calendarMonthDate, state.selectedDate).forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day.day);
    button.classList.toggle("is-muted", !day.currentMonth);
    button.classList.toggle("is-selected", day.selected);
    button.classList.toggle("is-today", day.today);
    button.setAttribute("aria-label", `${day.weekday}, ${formatDateDisplayParts(day.iso).dateLabel}`);
    button.addEventListener("click", async () => {
      setDatePopoverOpen(false);
      await updateSelectedDate(day.iso);
    });
    grid.append(button);
  });
}

function setCalendarMonthOffset(offset) {
  const date = parseDateISO(state.calendarMonthDate);
  date.setMonth(date.getMonth() + offset, 1);
  state.calendarMonthDate = toDateISO(date);
  renderCalendar();
}

async function updateSelectedDate(dateISO) {
  state.selectedDate = dateISO || getTodayISO();
  state.calendarMonthDate = getMonthStartISO(state.selectedDate);
  renderDatePicker();
  await refreshData({ reason: "date-change", force: true });
}

function clearAutoRefreshTimer() {
  if (refreshRuntime.timerId && typeof window !== "undefined") {
    window.clearTimeout(refreshRuntime.timerId);
  }

  refreshRuntime.timerId = null;
}

function canAutoRefresh() {
  return (
    typeof window !== "undefined" &&
    (!("onLine" in navigator) || navigator.onLine) &&
    (typeof document === "undefined" || !document.hidden)
  );
}

function renderAutoRefreshStatus() {
  const element = document.querySelector("#auto-refresh-status");
  if (!element) {
    return;
  }

  const games = state.data.games || [];
  const hasLiveGame = hasLiveGamesOnDate(games, state.selectedDate);
  const interval = getAutoRefreshInterval(state.selectedDate, games);

  element.classList.toggle("is-live", hasLiveGame);
  element.classList.toggle("is-paused", !canAutoRefresh());

  if (refreshRuntime.inFlight) {
    element.textContent = "Auto: atualizando";
  } else if (!navigator.onLine) {
    element.textContent = "Auto: offline";
  } else if (document.hidden) {
    element.textContent = "Auto: pausado";
  } else {
    element.textContent = hasLiveGame
      ? `Ao vivo: ${formatRefreshInterval(interval)}`
      : `Auto: ${formatRefreshInterval(interval)}`;
  }
}

function scheduleAutoRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  clearAutoRefreshTimer();
  renderAutoRefreshStatus();

  if (!canAutoRefresh()) {
    return;
  }

  const interval = getAutoRefreshInterval(state.selectedDate, state.data.games || []);
  refreshRuntime.timerId = window.setTimeout(() => {
    refreshData({ reason: "auto" });
  }, interval);
}

function refreshWhenDue(reason) {
  const interval = getAutoRefreshInterval(state.selectedDate, state.data.games || []);
  const elapsed = Date.now() - refreshRuntime.lastStartedAt;

  if (!refreshRuntime.lastStartedAt || elapsed >= interval) {
    refreshData({ reason, force: true });
    return;
  }

  scheduleAutoRefresh();
}

function createBroadcastChip(channel) {
  const broadcast = normalizeBroadcast(channel);
  const chip = document.createElement("span");
  chip.className = "broadcast-chip";
  chip.textContent = broadcast.name;
  const isHabitual = !broadcast.guaranteed && broadcast.source === "manual";
  chip.classList.toggle("is-guaranteed", broadcast.guaranteed);
  chip.classList.toggle("is-habitual", isHabitual);
  chip.dataset.type = broadcast.type;
  chip.title = broadcast.guaranteed
    ? `${broadcast.name} - transmissão confirmada para esta competição`
    : isHabitual
      ? `${broadcast.name} - transmissão habitual da competição (confirme a grade do dia)`
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
  status.classList.toggle("is-live", isGameInProgress(game.status));
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

function getCurrentFilteredGames() {
  return filterGames(state.data.games || [], state);
}

function getCurrentShareMessage() {
  return formatGamesShareMessage(getCurrentFilteredGames(), {
    dateISO: state.selectedDate,
    sourceLabel: state.data.source?.label || ""
  });
}

function setWhatsAppStatus(message, type = "") {
  const element = document.querySelector("#whatsapp-status");
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("is-error", type === "error");
  element.classList.toggle("is-success", type === "success");
}

function renderWhatsAppPanel() {
  const input = document.querySelector("#whatsapp-phone");
  const presetButton = document.querySelector("#whatsapp-default-contact");
  const presetStatus = document.querySelector("#whatsapp-default-contact-status");
  const selectedPreset = state.selectedWhatsAppPresetContactId
    ? getWhatsAppPresetContact(state.selectedWhatsAppPresetContactId)
    : null;
  const defaultPreset = getWhatsAppPresetContact();

  if (input && document.activeElement !== input) {
    input.value = selectedPreset ? "" : formatWhatsAppPhoneInput(state.whatsAppPhone);
  }

  if (presetButton && defaultPreset) {
    const isSelected = selectedPreset?.id === defaultPreset.id;
    presetButton.classList.toggle("is-selected", isSelected);
    presetButton.setAttribute("aria-pressed", String(isSelected));
  }

  if (presetStatus) {
    presetStatus.textContent = selectedPreset ? "Selecionado" : "Toque para usar";
  }
}

function setWhatsAppPanelOpen(isOpen) {
  const panel = document.querySelector("#whatsapp-panel");
  const input = document.querySelector("#whatsapp-phone");

  if (!panel) {
    return;
  }

  panel.hidden = !isOpen;
  setWhatsAppStatus("");

  if (isOpen) {
    renderWhatsAppPanel();
    input?.focus();
  }
}

function openWhatsAppUrl(url) {
  if (url) {
    window.location.href = url;
  }
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continua para o fallback abaixo.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function handleWhatsAppSubmit(event) {
  event.preventDefault();

  const input = document.querySelector("#whatsapp-phone");
  const phone = getSelectedWhatsAppPhone(input?.value || "");
  const isPresetContact = Boolean(state.selectedWhatsAppPresetContactId);

  if (!phone) {
    setWhatsAppStatus("Selecione o contato padrao ou informe um telefone com DDI e DDD.", "error");
    input?.focus();
    return;
  }

  if (!isPresetContact) {
    state.whatsAppPhone = phone;
    saveWhatsAppPhonePreference(phone);

    if (input) {
      input.value = phone;
    }
  }

  setWhatsAppStatus("Abrindo WhatsApp...", "success");
  openWhatsAppUrl(buildWhatsAppUrl(phone, getCurrentShareMessage()));
}

function handleWhatsAppPresetContactClick() {
  state.selectedWhatsAppPresetContactId = WHATSAPP_DEFAULT_CONTACT_ID;
  setWhatsAppStatus("Contato padrao selecionado.", "success");
  renderWhatsAppPanel();
}

function handleWhatsAppPhoneInput(event) {
  const input = event?.currentTarget || document.querySelector("#whatsapp-phone");

  if (input) {
    const masked = formatWhatsAppPhoneInput(input.value);
    if (masked !== input.value) {
      input.value = masked;
      input.setSelectionRange?.(masked.length, masked.length);
    }
  }

  if (!state.selectedWhatsAppPresetContactId) {
    return;
  }

  state.selectedWhatsAppPresetContactId = "";
  setWhatsAppStatus("");
  renderWhatsAppPanel();
}

async function handleWhatsAppCopy() {
  const copied = await copyTextToClipboard(getCurrentShareMessage());

  setWhatsAppStatus(
    copied ? "Mensagem copiada." : "Nao foi possivel copiar automaticamente.",
    copied ? "success" : "error"
  );
}

function renderApp() {
  renderCompetitionTabs();
  renderDatePicker();
  const filteredGames = getCurrentFilteredGames();
  renderGames(filteredGames);
  renderSummary(filteredGames);
  renderConnectionStatus();
  renderAutoRefreshStatus();
  renderGoalNotificationToggle();
  renderWhatsAppPanel();
  setText("#updated-at", formatDateTime(state.data.updatedAt));
  setText("#source-label", state.data.source?.label || "Fonte não informada");
}

async function refreshData(options = {}) {
  const reason = options.reason || "manual";
  const force = Boolean(options.force);
  const button = document.querySelector("#refresh-button");
  const now = Date.now();

  if (refreshRuntime.inFlight) {
    if (force || reason === "date-change") {
      refreshRuntime.pendingOptions = { force: true, reason };
    }
    return state.data;
  }

  if (
    !force &&
    reason === "manual" &&
    refreshRuntime.lastStartedAt &&
    now - refreshRuntime.lastStartedAt < AUTO_REFRESH_INTERVALS.minManual
  ) {
    renderAutoRefreshStatus();
    return state.data;
  }

  clearAutoRefreshTimer();
  refreshRuntime.inFlight = true;
  refreshRuntime.lastStartedAt = now;
  button?.classList.add("is-loading");

  try {
    const previousGames = state.data.games || [];
    const nextData = await loadGamesData();
    const nextGames = nextData.games || [];
    notifyGoalEvents(previousGames, nextGames);
    state.data = nextData;
    postGoalNotificationStateToServiceWorker(nextGames);
    return state.data;
  } finally {
    const pendingOptions = refreshRuntime.pendingOptions;
    refreshRuntime.pendingOptions = null;
    refreshRuntime.inFlight = false;
    button?.classList.remove("is-loading");
    renderApp();
    if (pendingOptions) {
      refreshData(pendingOptions);
    } else {
      scheduleAutoRefresh();
    }
  }
}

function bindEvents() {
  const datePicker = document.querySelector("#date-picker");
  const dateDisplay = document.querySelector("#date-display");
  const datePrev = document.querySelector("#date-prev");
  const dateNext = document.querySelector("#date-next");
  const dateToday = document.querySelector("#date-today");
  const prevMonth = document.querySelector("#calendar-prev-month");
  const nextMonth = document.querySelector("#calendar-next-month");
  const searchFilter = document.querySelector("#search-filter");
  const refreshButton = document.querySelector("#refresh-button");
  const whatsAppButton = document.querySelector("#whatsapp-button");
  const whatsAppForm = document.querySelector("#whatsapp-form");
  const whatsAppPhoneInput = document.querySelector("#whatsapp-phone");
  const whatsAppPresetButton = document.querySelector("#whatsapp-default-contact");
  const whatsAppCopyButton = document.querySelector("#whatsapp-copy-button");
  const goalNotificationsToggle = document.querySelector("#goal-notifications-toggle");

  datePrev?.addEventListener("click", () => updateSelectedDate(shiftDateISO(state.selectedDate, -1)));
  dateNext?.addEventListener("click", () => updateSelectedDate(shiftDateISO(state.selectedDate, 1)));
  dateToday?.addEventListener("click", () => {
    setDatePopoverOpen(false);
    updateSelectedDate(getTodayISO());
  });
  dateDisplay?.addEventListener("click", () => {
    const popover = document.querySelector("#date-popover");
    setDatePopoverOpen(Boolean(popover?.hidden));
  });
  prevMonth?.addEventListener("click", () => setCalendarMonthOffset(-1));
  nextMonth?.addEventListener("click", () => setCalendarMonthOffset(1));

  document.addEventListener("click", (event) => {
    if (datePicker && !datePicker.contains(event.target)) {
      setDatePopoverOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDatePopoverOpen(false);
    }
  });

  if (searchFilter) {
    searchFilter.addEventListener("input", () => {
      state.query = searchFilter.value;
      renderApp();
    });
  }

  refreshButton?.addEventListener("click", () => refreshData({ reason: "manual" }));
  whatsAppButton?.addEventListener("click", () => {
    const panel = document.querySelector("#whatsapp-panel");
    setWhatsAppPanelOpen(Boolean(panel?.hidden));
  });
  whatsAppForm?.addEventListener("submit", handleWhatsAppSubmit);
  whatsAppPhoneInput?.addEventListener("input", handleWhatsAppPhoneInput);
  whatsAppPresetButton?.addEventListener("click", handleWhatsAppPresetContactClick);
  whatsAppCopyButton?.addEventListener("click", handleWhatsAppCopy);
  goalNotificationsToggle?.addEventListener("change", (event) => {
    setGoalNotificationsEnabled(event.currentTarget.checked);
  });
  window.addEventListener("online", () => refreshWhenDue("online"));
  window.addEventListener("offline", () => {
    clearAutoRefreshTimer();
    renderConnectionStatus();
    renderAutoRefreshStatus();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearAutoRefreshTimer();
      renderAutoRefreshStatus();
      return;
    }

    refreshWhenDue("visible");
  });
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    postGoalNotificationStateToServiceWorker();
  });
}

async function initApp() {
  bindEvents();
  renderApp();
  await registerAppServiceWorker();
  await refreshData({ reason: "initial", force: true });
  if (areGoalNotificationsActive()) {
    registerGoalBackgroundSync();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    AUTO_REFRESH_INTERVALS,
    COMPETITIONS,
    FALLBACK_DATA,
    LEAGUES,
    buildWhatsAppUrl,
    buildScoreboardUrl,
    detectGoalEvents,
    formatBroadcastsForShare,
    formatDateDisplayParts,
    formatGamesShareMessage,
    formatRefreshInterval,
    filterGames,
    gameMatchesQuery,
    getAutoRefreshInterval,
    getMatchDisplayValue,
    getStatusLabel,
    mapEspnEvent,
    mapEspnScoreboard,
    getCalendarDays,
    getMonthStartISO,
    getTodayISO,
    getWhatsAppPresetContact,
    enrichBroadcastsForCompetition,
    getBroadcastName,
    getNormalizedBroadcasts,
    normalizeWhatsAppPhone,
    formatWhatsAppPhoneInput,
    normalizeText,
    normalizeBroadcast,
    parseScore,
    shiftDateISO,
    sortGamesByTime,
    summarizeGames
  };
}
