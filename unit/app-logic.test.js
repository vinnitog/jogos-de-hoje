const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTO_REFRESH_INTERVALS,
  FALLBACK_DATA,
  LEAGUES,
  buildScoreboardUrl,
  detectGoalEvents,
  enrichBroadcastsForCompetition,
  filterGames,
  formatDateDisplayParts,
  formatRefreshInterval,
  gameMatchesQuery,
  getAutoRefreshInterval,
  getBroadcastName,
  getCalendarDays,
  getMonthStartISO,
  getNormalizedBroadcasts,
  getMatchDisplayValue,
  getStatusLabel,
  mapEspnScoreboard,
  normalizeBroadcast,
  normalizeText,
  parseScore,
  shiftDateISO,
  sortGamesByTime,
  summarizeGames
} = require("../js/app.js");

const TEST_GAMES = [
  {
    competition: "Libertadores",
    date: "2026-06-15",
    time: "21:00",
    home: "São Paulo",
    away: "Nacional",
    venue: "Morumbis, São Paulo",
    status: "live",
    broadcasts: ["ESPN", "Disney+"]
  },
  {
    competition: "Brasileirão Série A",
    date: "2026-06-15",
    time: "19:00",
    home: "Palmeiras",
    away: "Flamengo",
    venue: "Allianz Parque, São Paulo",
    status: "scheduled",
    broadcasts: []
  },
  {
    competition: "Copa do Mundo 2026",
    date: "2026-06-16",
    time: "13:00",
    home: "Brasil",
    away: "Marrocos",
    venue: "MetLife Stadium",
    status: "scheduled",
    broadcasts: ["Globo"]
  }
];

const ESPN_SCOREBOARD = {
  events: [
    {
      id: "760428",
      date: "2026-06-15T16:00Z",
      season: {
        slug: "group-stage"
      },
      links: [
        {
          rel: ["summary", "desktop", "event"],
          href: "https://www.espn.com/soccer/match/_/gameId/760428"
        }
      ],
      competitions: [
        {
          date: "2026-06-15T16:00Z",
          altGameNote: "Copa, Grupo H",
          status: {
            type: {
              state: "post",
              completed: true,
              name: "STATUS_FULL_TIME",
              description: "Full Time"
            }
          },
          venue: {
            fullName: "Mercedes-Benz Stadium",
            address: {
              city: "Atlanta, Georgia",
              country: "USA"
            }
          },
          broadcasts: [
            {
              names: ["FOX", "Tele", "Peacock"]
            }
          ],
          competitors: [
            {
              homeAway: "home",
              score: "0",
              team: {
                displayName: "Espanha"
              }
            },
            {
              homeAway: "away",
              score: "0",
              team: {
                displayName: "Cabo Verde"
              }
            }
          ]
        }
      ]
    }
  ]
};

test("filters games by date, competition and normalized query", () => {
  const games = filterGames(TEST_GAMES, {
    selectedDate: "2026-06-15",
    selectedCompetition: "Libertadores",
    query: "sao paulo"
  });

  assert.equal(games.length, 1);
  assert.equal(games[0].home, "São Paulo");
});

test("sorts games by kickoff time", () => {
  const games = sortGamesByTime([
    { time: "21:30", home: "B" },
    { time: "19:00", home: "A" }
  ]);

  assert.deepEqual(games.map((game) => game.time), ["19:00", "21:30"]);
});

test("formats and shifts custom date picker values", () => {
  assert.equal(shiftDateISO("2026-06-15", 1), "2026-06-16");
  assert.equal(shiftDateISO("2026-06-15", -1), "2026-06-14");
  assert.equal(getMonthStartISO("2026-06-15"), "2026-06-01");
  assert.deepEqual(formatDateDisplayParts("2026-06-15", "2026-06-15"), {
    dayLabel: "Hoje",
    dateLabel: "15/06/2026"
  });
  assert.equal(formatDateDisplayParts("2026-06-16", "2026-06-15").dayLabel, "Amanhã");
});

test("builds a fixed calendar grid for the selected month", () => {
  const days = getCalendarDays("2026-06-01", "2026-06-15", "2026-06-15");
  const selectedDay = days.find((day) => day.selected);

  assert.equal(days.length, 42);
  assert.equal(selectedDay.iso, "2026-06-15");
  assert.equal(selectedDay.today, true);
  assert.equal(days.some((day) => !day.currentMonth), true);
});

test("chooses conservative auto refresh intervals", () => {
  assert.equal(
    getAutoRefreshInterval("2026-06-15", [{ date: "2026-06-15", status: "live" }], "2026-06-15"),
    AUTO_REFRESH_INTERVALS.live
  );
  assert.equal(
    getAutoRefreshInterval("2026-06-15", [{ date: "2026-06-15", status: "scheduled" }], "2026-06-15"),
    AUTO_REFRESH_INTERVALS.today
  );
  assert.equal(getAutoRefreshInterval("2026-06-16", [], "2026-06-15"), AUTO_REFRESH_INTERVALS.otherDate);
  assert.equal(formatRefreshInterval(AUTO_REFRESH_INTERVALS.live), "90s");
  assert.equal(formatRefreshInterval(AUTO_REFRESH_INTERVALS.today), "4 min");
});

test("summarizes total, live games and broadcasts", () => {
  const summary = summarizeGames(
    TEST_GAMES.filter((game) => game.date === "2026-06-15")
  );

  assert.deepEqual(summary, {
    total: 2,
    live: 1,
    withBroadcast: 1
  });
});

test("ignores empty broadcast entries", () => {
  assert.deepEqual(getNormalizedBroadcasts(["", null, { name: "SporTV" }]), [
    {
      name: "SporTV",
      type: "unknown",
      guaranteed: false,
      source: "api"
    }
  ]);

  assert.equal(
    summarizeGames([{ status: "scheduled", broadcasts: ["", null] }]).withBroadcast,
    0
  );
});

test("normalizes string and object broadcasts", () => {
  assert.deepEqual(normalizeBroadcast("ESPN", { source: "espn" }), {
    name: "ESPN",
    type: "unknown",
    guaranteed: false,
    source: "espn"
  });

  assert.deepEqual(
    normalizeBroadcast({
      name: "CazéTV",
      type: "streaming",
      guaranteed: true,
      source: "manual"
    }),
    {
      name: "CazéTV",
      type: "streaming",
      guaranteed: true,
      source: "manual"
    }
  );
});

test("adds CazéTV as guaranteed World Cup 2026 fallback only", () => {
  const worldCupBroadcasts = enrichBroadcastsForCompetition("Copa do Mundo 2026", []);
  const brasileiraoBroadcasts = enrichBroadcastsForCompetition("Brasileirão Série A", []);

  assert.deepEqual(worldCupBroadcasts, [
    {
      name: "CazéTV",
      type: "streaming",
      guaranteed: true,
      source: "manual"
    }
  ]);
  assert.deepEqual(brasileiraoBroadcasts, []);
});

test("deduplicates World Cup fallback with source broadcasts", () => {
  const broadcasts = enrichBroadcastsForCompetition("Copa do Mundo 2026", [
    "CazéTV",
    "Globo"
  ]);

  assert.deepEqual(broadcasts.map(getBroadcastName), ["CazéTV", "Globo"]);
  assert.equal(broadcasts[0].guaranteed, true);
  assert.equal(broadcasts[0].type, "streaming");
});

test("search matches broadcasts without accents", () => {
  const game = TEST_GAMES.find((item) => item.home === "São Paulo");

  assert.equal(normalizeText("São Paulo"), "sao paulo");
  assert.equal(gameMatchesQuery(game, "disney"), true);
});

test("returns readable status labels", () => {
  assert.equal(getStatusLabel("live"), "Ao vivo");
  assert.equal(getStatusLabel("unknown"), "Programado");
});

test("shows kickoff time before the match and score after kickoff", () => {
  assert.equal(
    getMatchDisplayValue({
      status: "scheduled",
      time: "16:00",
      score: "0 x 0"
    }),
    "16:00"
  );
  assert.equal(
    getMatchDisplayValue({
      status: "live",
      time: "16:00",
      score: "1 x 0"
    }),
    "1 x 0"
  );
  assert.equal(
    getMatchDisplayValue({
      status: "finished",
      time: "16:00",
      score: "2 x 2"
    }),
    "2 x 2"
  );
});

test("parses score strings for goal detection", () => {
  assert.deepEqual(parseScore("2 x 1"), {
    home: 2,
    away: 1,
    total: 3
  });
  assert.deepEqual(parseScore(" 10 X 2 "), {
    home: 10,
    away: 2,
    total: 12
  });
  assert.equal(parseScore("16:00"), null);
  assert.equal(parseScore("Palmeiras 1 x 0 Flamengo"), null);
  assert.equal(parseScore("1-0"), null);
});

test("detects goal notifications only when the score increases", () => {
  const previousGames = [
    {
      id: "bra.1-1",
      competition: "Brasileirao Serie A",
      date: "2026-06-15",
      home: "Palmeiras",
      away: "Flamengo",
      status: "live",
      score: "0 x 0"
    },
    {
      id: "bra.1-2",
      competition: "Brasileirao Serie A",
      date: "2026-06-15",
      home: "Santos",
      away: "Bahia",
      status: "live",
      score: "1 x 1"
    }
  ];
  const nextGames = [
    {
      ...previousGames[0],
      score: "1 x 0"
    },
    {
      ...previousGames[1],
      score: "1 x 1"
    }
  ];

  const events = detectGoalEvents(previousGames, nextGames);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Gol do Palmeiras!");
  assert.equal(events[0].body, "Brasileirao Serie A: Palmeiras 1 x 0 Flamengo");
});

test("detects away team and multiple goal notification events", () => {
  const previousGames = [
    {
      id: "bra.1-1",
      competition: "Brasileirao Serie A",
      date: "2026-06-15",
      home: "Palmeiras",
      away: "Flamengo",
      status: "live",
      score: "0 x 0"
    },
    {
      id: "lib-1",
      competition: "Libertadores",
      date: "2026-06-15",
      home: "Sao Paulo",
      away: "Nacional",
      status: "live",
      score: "1 x 1"
    }
  ];

  const events = detectGoalEvents(previousGames, [
    {
      ...previousGames[0],
      score: "0 x 2"
    },
    {
      ...previousGames[1],
      score: "2 x 2"
    }
  ]);

  assert.equal(events.length, 2);
  assert.equal(events[0].title, "Gols do Flamengo!");
  assert.deepEqual(events[0].scoringTeams, ["Flamengo"]);
  assert.equal(events[0].goalCount, 2);
  assert.equal(events[1].title, "Gols na partida!");
  assert.deepEqual(events[1].scoringTeams, ["Sao Paulo", "Nacional"]);
});

test("does not notify goals for first load or non-live games", () => {
  assert.deepEqual(
    detectGoalEvents([], [
      {
        id: "bra.1-1",
        competition: "Brasileirao Serie A",
        date: "2026-06-15",
        home: "Palmeiras",
        away: "Flamengo",
        status: "live",
        score: "1 x 0"
      }
    ]),
    []
  );

  assert.deepEqual(
    detectGoalEvents(
      [
        {
          id: "bra.1-1",
          competition: "Brasileirao Serie A",
          date: "2026-06-15",
          home: "Palmeiras",
          away: "Flamengo",
          status: "scheduled",
          score: ""
        }
      ],
      [
        {
          id: "bra.1-1",
          competition: "Brasileirao Serie A",
          date: "2026-06-15",
          home: "Palmeiras",
          away: "Flamengo",
          status: "scheduled",
          score: "1 x 0"
        }
      ]
    ),
    []
  );
});

test("matches goal events without ids by normalized game identity", () => {
  const previousGame = {
    competition: "Brasileirao Serie A",
    date: "2026-06-15",
    home: "Sao Paulo",
    away: "Bahia",
    status: "live",
    score: "0 x 0"
  };
  const events = detectGoalEvents(
    [previousGame],
    [
      {
        ...previousGame,
        home: "SÃO PAULO",
        score: "1 x 0"
      }
    ]
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Gol do SÃO PAULO!");
});

test("does not mix equal teams from different dates or competitions", () => {
  const game = {
    competition: "Brasileirao Serie A",
    date: "2026-06-15",
    home: "Palmeiras",
    away: "Flamengo",
    status: "live",
    score: "0 x 0"
  };

  assert.deepEqual(
    detectGoalEvents(
      [game],
      [
        {
          ...game,
          date: "2026-06-16",
          score: "1 x 0"
        },
        {
          ...game,
          competition: "Copa do Brasil",
          score: "1 x 0"
        }
      ]
    ),
    []
  );
});

test("detects goals from live to finished status", () => {
  const game = {
    id: "bra.1-1",
    competition: "Brasileirao Serie A",
    date: "2026-06-15",
    home: "Palmeiras",
    away: "Flamengo",
    score: "0 x 0"
  };
  const events = detectGoalEvents(
    [
      {
        ...game,
        status: "live"
      }
    ],
    [
      {
        ...game,
        status: "finished",
        score: "0 x 1"
      }
    ]
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Gol do Flamengo!");
  assert.equal(events[0].score, "0 x 1");
});

test("does not notify when a scoreboard correction lowers one side", () => {
  const game = {
    id: "bra.1-1",
    competition: "Brasileirao Serie A",
    date: "2026-06-15",
    home: "Palmeiras",
    away: "Flamengo",
    status: "live"
  };

  assert.deepEqual(
    detectGoalEvents(
      [
        {
          ...game,
          score: "2 x 1"
        }
      ],
      [
        {
          ...game,
          score: "1 x 3"
        }
      ]
    ),
    []
  );
});

test("uses real ESPN league slugs including World Cup 2026", () => {
  assert.deepEqual(
    LEAGUES.map((league) => league.slug),
    [
      "bra.1",
      "bra.camp.paulista",
      "conmebol.libertadores",
      "bra.copa_do_brazil",
      "fifa.world"
    ]
  );
});

test("builds localized ESPN scoreboard URLs", () => {
  const url = buildScoreboardUrl("fifa.world", "2026-06-15");

  assert.equal(
    url,
    "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260615&region=br&lang=pt"
  );
});

test("maps ESPN scoreboard events to app games", () => {
  const games = mapEspnScoreboard(ESPN_SCOREBOARD, {
    name: "Copa do Mundo 2026",
    slug: "fifa.world"
  });

  assert.equal(games.length, 1);
  assert.equal(games[0].competition, "Copa do Mundo 2026");
  assert.equal(games[0].date, "2026-06-15");
  assert.equal(games[0].time, "13:00");
  assert.equal(games[0].home, "Espanha");
  assert.equal(games[0].away, "Cabo Verde");
  assert.equal(games[0].status, "finished");
  assert.equal(games[0].score, "0 x 0");
  assert.deepEqual(games[0].broadcasts.map(getBroadcastName), [
    "FOX",
    "Tele",
    "Peacock",
    "CazéTV"
  ]);
  assert.equal(games[0].broadcasts.at(-1).guaranteed, true);
});

test("fallback data does not include demonstrative matches", () => {
  assert.deepEqual(FALLBACK_DATA.games, []);
  assert.equal(FALLBACK_DATA.source.type, "offline");
});
