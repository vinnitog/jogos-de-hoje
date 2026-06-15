const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FALLBACK_DATA,
  filterGames,
  gameMatchesQuery,
  getStatusLabel,
  normalizeText,
  sortGamesByTime,
  summarizeGames
} = require("../js/app.js");

test("filters games by date, competition and normalized query", () => {
  const games = filterGames(FALLBACK_DATA.games, {
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
    FALLBACK_DATA.games.filter((game) => game.date === "2026-06-15")
  );

  assert.deepEqual(summary, {
    total: 3,
    live: 1,
    withBroadcast: 3
  });
});

test("search matches broadcasts without accents", () => {
  const game = FALLBACK_DATA.games.find((item) => item.home === "São Paulo");

  assert.equal(normalizeText("São Paulo"), "sao paulo");
  assert.equal(gameMatchesQuery(game, "disney"), true);
});

test("returns readable status labels", () => {
  assert.equal(getStatusLabel("live"), "Ao vivo");
  assert.equal(getStatusLabel("unknown"), "Programado");
});
