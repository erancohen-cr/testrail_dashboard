// Pure aggregation logic, shared by server routes and client components (types only on client).

export type FeatureDef = {
  planIds: number[];
  runIds: number[];
  suiteIds: number[];
  sectionIds: number[];
  filters: {
    titleContains?: string;
    refsContains?: string;
    priorityIds?: number[];
    typeIds?: number[];
    customField?: { name: string; value: string };
  };
};

export type Feature = { id: number; project_id: number; name: string; description: string; green: number; amber: number; def: FeatureDef };
export type FeatureSuite = { id: number; project_id: number; name: string; description: string; green: number; amber: number; feature_ids: number[] };

export type Test = {
  id: number;
  case_id: number;
  title: string;
  status_id: number;
  run_id: number;
  run_name: string;
  plan_id: number | null;
  plan_name: string | null;
  suite_id: number | null;
  section_id: number | null;
  priority_id: number | null;
  type_id: number | null;
  refs: string | null;
  latest: number; // created_on of most recent result, 0 if none
  custom: Record<string, unknown>;
};

export type Stats = { total: number; passed: number; failed: number; blocked: number; retest: number; other: number; untested: number; executed: number; pct: number };
export type Row = { key: string; name: string; type?: "plan" | "run"; stats: Stats };
export type Band = "green" | "amber" | "red";
export type Card = {
  id: string;
  kind: "overall" | "plan" | "run" | "feature" | "suite";
  name: string;
  sub: string;
  stats: Stats;
  band: Band;
  children: Row[];
  bySource: Row[];
  bySection: Row[];
  tests: Pick<Test, "id" | "case_id" | "title" | "status_id" | "run_name">[];
};

export const STATUS = { 1: "passed", 2: "blocked", 3: "untested", 4: "retest", 5: "failed" } as const;
export const statusName = (id: number) => STATUS[id as keyof typeof STATUS] ?? "other";

export function stats(tests: Pick<Test, "status_id">[]): Stats {
  const s: Stats = { total: tests.length, passed: 0, failed: 0, blocked: 0, retest: 0, other: 0, untested: 0, executed: 0, pct: 0 };
  for (const t of tests) s[statusName(t.status_id)]++;
  s.executed = s.total - s.untested;
  s.pct = s.total ? Math.round((s.executed / s.total) * 100) : 0;
  return s;
}

export const band = (pct: number, green: number, amber: number): Band => (pct >= green ? "green" : pct >= amber ? "amber" : "red");

/** One test per case: the one with the most recent result (untested loses to any result). */
export function dedupe(tests: Test[]): Test[] {
  const best = new Map<number, Test>();
  for (const t of tests) {
    const cur = best.get(t.case_id);
    if (!cur || t.latest > cur.latest || (t.latest === cur.latest && t.run_id > cur.run_id)) best.set(t.case_id, t);
  }
  return [...best.values()];
}

/** The given section ids plus every descendant. */
export function withDescendants(sections: { id: number; parent_id: number | null }[], ids: number[]): Set<number> {
  const kids = new Map<number, number[]>();
  for (const s of sections) if (s.parent_id) kids.set(s.parent_id, [...(kids.get(s.parent_id) ?? []), s.id]);
  const out = new Set<number>();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(kids.get(id) ?? []));
  }
  return out;
}

export function matchFeature(t: Test, def: FeatureDef, sectionSet: Set<number> | null): boolean {
  const f = def.filters ?? {};
  if (!(def.planIds.includes(t.plan_id ?? -1) || def.runIds.includes(t.run_id))) return false;
  if (def.suiteIds.length && !def.suiteIds.includes(t.suite_id ?? -1)) return false;
  if (sectionSet && !sectionSet.has(t.section_id ?? -1)) return false;
  if (f.titleContains && !t.title.toLowerCase().includes(f.titleContains.toLowerCase())) return false;
  if (f.refsContains && !(t.refs ?? "").toLowerCase().includes(f.refsContains.toLowerCase())) return false;
  if (f.priorityIds?.length && !f.priorityIds.includes(t.priority_id ?? -1)) return false;
  if (f.typeIds?.length && !f.typeIds.includes(t.type_id ?? -1)) return false;
  if (f.customField?.name) {
    const v = t.custom[f.customField.name.startsWith("custom_") ? f.customField.name : `custom_${f.customField.name}`];
    if (String(v ?? "").toLowerCase() !== f.customField.value.toLowerCase()) return false;
  }
  return true;
}

export function groupRows(tests: Test[], key: (t: Test) => string, name: (t: Test) => string, type?: (t: Test) => Row["type"]): Row[] {
  const groups = new Map<string, Test[]>();
  for (const t of tests) groups.set(key(t), [...(groups.get(key(t)) ?? []), t]);
  return [...groups.entries()].map(([k, ts]) => ({ key: k, name: name(ts[0]), type: type?.(ts[0]), stats: stats(ts) }));
}

export function makeCard(
  base: Pick<Card, "id" | "kind" | "name" | "sub">,
  tests: Test[],
  sectionName: (id: number | null) => string,
  green = 90,
  amber = 70,
  children: Row[] = [],
): Card {
  const s = stats(tests);
  const bySource =
    base.kind === "plan" || base.kind === "run"
      ? groupRows(tests, (t) => `run:${t.run_id}`, (t) => t.run_name, () => "run")
      : groupRows(
          tests,
          (t) => (t.plan_id ? `plan:${t.plan_id}` : `run:${t.run_id}`),
          (t) => t.plan_name ?? t.run_name,
          (t) => (t.plan_id ? "plan" : "run"),
        );
  return {
    ...base,
    stats: s,
    band: band(s.pct, green, amber),
    children,
    bySource,
    bySection: groupRows(tests, (t) => String(t.section_id), (t) => sectionName(t.section_id)),
    // ponytail: full test list inline; lazy-load per card if payloads get heavy
    tests: tests
      .map(({ id, case_id, title, status_id, run_name }) => ({ id, case_id, title, status_id, run_name }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}
