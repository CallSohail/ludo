import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanHistory,
  stats,
  timeline,
  filterPeriod,
  dailyData,
  distribution,
  csvCell,
} from "../src/analytics.js";
const raw = [
  {
    player_id: "a",
    event_number: 1,
    points: 3,
    created_at: "2026-10-24T23:30:00Z",
  },
  {
    player_id: "a",
    event_number: 2,
    points: -1,
    created_at: "2026-10-25T02:30:00Z",
  },
  {
    player_id: "b",
    event_number: 3,
    points: 9,
    created_at: "2026-10-25T05:00:00Z",
  },
];
test("awards, corrections and net totals stay distinct", () => {
  const s = stats(cleanHistory(raw));
  assert.equal(s.positive, 12);
  assert.equal(s.corrected, -1);
  assert.equal(s.net, 11);
  assert.equal(s.awards, 2);
  assert.equal(s.average, 6);
});
test("timeline uses real event times and preserves negative corrections", () => {
  const e = cleanHistory(raw);
  const t = timeline(e, [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(
    t.map((r) => r.a),
    [0, 3, 2, 2],
  );
  assert.equal(t.at(-1).b, 9);
  assert.equal(t[2].time, new Date(raw[1].created_at).getTime());
});
test("Paris local days remain correct across daylight-saving change", () => {
  const data = dailyData(cleanHistory(raw));
  assert.equal(data.length, 1);
  assert.equal(data[0].day, "2026-10-25");
  assert.equal(data[0].awards, 12);
  assert.equal(data[0].corrections, -1);
});
test("invalid events and duplicate receipts cannot inflate the analysis", () => {
  assert.equal(
    cleanHistory([
      ...raw,
      raw[0],
      { player_id: "a", points: 2, created_at: "bad" },
    ]).length,
    3,
  );
});
test("empty history has no fabricated timeline and no division by zero", () => {
  assert.deepEqual(timeline([], []), []);
  assert.equal(stats([]).average, 0);
  assert.equal(
    distribution([]).reduce((s, d) => s + d.count, 0),
    0,
  );
});
test("date ranges exclude older and future events", () => {
  const now = Date.parse("2026-10-25T06:00:00Z");
  assert.equal(filterPeriod(cleanHistory(raw), "7", now).length, 3);
  assert.equal(
    filterPeriod(cleanHistory(raw), "7", now + 30 * 86400000).length,
    0,
  );
});
test("CSV quotes delimiters and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("-2"), '"\'-2"');
  assert.equal(csvCell(-2), '"-2"');
});

test("daily buckets use consistent anchors and preserve calendar gaps", () => {
  const e = cleanHistory([
    { player_id: "a", points: 1, created_at: "2026-10-01T01:00:00Z" },
    { player_id: "a", points: 1, created_at: "2026-10-08T22:00:00Z" },
  ]);
  const data = dailyData(e);
  assert.equal(data[0].time, Date.parse("2026-10-01T12:00:00Z"));
  assert.equal(data[1].time - data[0].time, 8 * 86400000);
});
