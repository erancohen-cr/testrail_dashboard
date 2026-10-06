import { test } from "node:test";
import assert from "node:assert/strict";
import { band, dedupe, matchFeature, stats, withDescendants, type FeatureDef, type Test } from "./aggregate.ts";

const t = (o: Partial<Test>): Test => ({
  id: 1, case_id: 1, title: "x", status_id: 3, run_id: 1, run_name: "r", plan_id: null, plan_name: null,
  suite_id: 1, section_id: 1, priority_id: 2, type_id: 1, refs: null, latest: 0, custom: {}, ...o,
});

test("dedupe keeps most recent result, untested loses", () => {
  const out = dedupe([
    t({ id: 1, case_id: 7, status_id: 5, latest: 100 }),
    t({ id: 2, case_id: 7, status_id: 1, latest: 200 }),
    t({ id: 3, case_id: 7, status_id: 3, latest: 0, run_id: 9 }),
    t({ id: 4, case_id: 8 }),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((x) => x.case_id === 7)!.id, 2);
});

test("stats and band", () => {
  const s = stats([t({ status_id: 1 }), t({ status_id: 5 }), t({ status_id: 3 }), t({ status_id: 8 })]);
  assert.deepEqual([s.total, s.passed, s.failed, s.untested, s.other, s.executed, s.pct], [4, 1, 1, 1, 1, 3, 75]);
  assert.equal(band(90, 90, 70), "green");
  assert.equal(band(70, 90, 70), "amber");
  assert.equal(band(69, 90, 70), "red");
  assert.equal(stats([]).pct, 0);
});

test("section descendants", () => {
  const set = withDescendants([{ id: 1, parent_id: null }, { id: 2, parent_id: 1 }, { id: 3, parent_id: 2 }, { id: 4, parent_id: null }], [1]);
  assert.deepEqual([...set].sort(), [1, 2, 3]);
});

test("feature filter", () => {
  const def: FeatureDef = { planIds: [10], runIds: [5], suiteIds: [], sectionIds: [], filters: { titleContains: "usb", priorityIds: [4] } };
  assert.ok(matchFeature(t({ plan_id: 10, title: "Block USB", priority_id: 4 }), def, null));
  assert.ok(matchFeature(t({ run_id: 5, title: "usb", priority_id: 4 }), def, null));
  assert.ok(!matchFeature(t({ plan_id: 11, title: "usb", priority_id: 4 }), def, null));
  assert.ok(!matchFeature(t({ plan_id: 10, title: "MTP", priority_id: 4 }), def, null));
  assert.ok(!matchFeature(t({ plan_id: 10, title: "usb", priority_id: 4, section_id: 9 }), def, new Set([1])));
});
