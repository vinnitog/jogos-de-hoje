const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FALLBACK_DATA,
  LEAGUES,
  buildScoreboardUrl,
  filterGames,
  gameMatchesQuery,
  getMatchDisplayValue,
  getStatusLabel,
  mapEspnScoreboard,
  normalizeText,
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
  assert.deepEqual(games[0].broadcasts, ["FOX", "Tele", "Peacock"]);
});

test("fallback data does not include demonstrative matches", () => {
  assert.deepEqual(FALLBACK_DATA.games, []);
  assert.equal(FALLBACK_DATA.source.type, "offline");
});
