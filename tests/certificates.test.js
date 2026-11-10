import { test } from "node:test";
import assert from "node:assert/strict";
import {
  certificateModel,
  normalizeMessage,
  safeCertificateFilename,
} from "../src/certificateModel.js";
const players = [
  { id: "a", name: "First", points_total: 9 },
  { id: "b", name: "Second", points_total: 9 },
  { id: "c", name: "Third", points_total: 1 },
  { id: "d", name: "Fourth", points_total: 0 },
];
const asOf = "2026-11-10T12:00:00Z";
test("the crown edition follows position rather than awarding match wins", () => {
  const m = certificateModel(players[0], players, [], asOf);
  assert.equal(m.leader, true);
  assert.equal(m.rank, 1);
  assert.equal(m.title, "Keeper of the penalty crown");
  assert.equal(m.historyAvailable, false);
  assert(m.commendations.some((c) => c.includes("2 players share this score")));
  assert(m.commendations.some((c) => c.includes("not available")));
});
test("each position has its own edition and current profile data", () => {
  for (let i = 0; i < players.length; i++) {
    const m = certificateModel(players[i], players, [], asOf);
    assert.equal(m.rank, i + 1);
    assert.equal(m.name, players[i].name);
    assert.equal(m.points, players[i].points_total);
  }
  assert.equal(
    certificateModel(players[3], players, [], asOf).title,
    "Clean record distinction",
  );
});
test("awards and corrections remain distinct in commendations", () => {
  const m = certificateModel(
    players[0],
    players,
    [
      { player_id: "a", points: 3, time: Date.parse(asOf) },
      { player_id: "a", points: -1, time: Date.parse(asOf) },
    ],
    asOf,
  );
  assert.equal(m.metric.awards, 1);
  assert.equal(m.metric.corrections, 1);
  assert.equal(m.metric.days, 1);
});
test("zero-point first position never claims the heaviest penalty crown", () => {
  const p = [{ id: "a", name: "Opening", points_total: 0 }];
  const m = certificateModel(p[0], p, [], asOf);
  assert.equal(m.title, "Opening table distinction");
  assert(!m.commendations.join(" ").includes("heaviest"));
});
test("archived players cannot receive a certificate from active standings", () =>
  assert.throws(
    () => certificateModel({ id: "gone" }, players, [], asOf),
    /no longer/,
  ));
test("download filenames and messages safely handle user text", () => {
  assert.equal(
    safeCertificateFilename("Évry / Test", 2, "pdf"),
    "ludo-2026-02-evry-test.pdf",
  );
  assert.equal(normalizeMessage("a\u0000b\r\nc"), "ab\nc");
  assert.equal(normalizeMessage("a".repeat(900)).length, 600);
});
