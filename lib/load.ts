import { tr, type Creds } from "./testrail";
import type { Test } from "./aggregate";

type RunMeta = { id: number; name: string; config: string | null; suite_id: number | null; plan_id: number | null; plan_name: string | null };

const runLabel = (r: { name: string; config?: string | null }) => (r.config ? `${r.name} (${r.config})` : r.name);

/** Expand plans into their runs; add standalone runs. */
export async function resolveRuns(c: Creds, planIds: number[], runIds: number[], refresh: boolean) {
  const runs = new Map<number, RunMeta>();
  const plans = await Promise.all(planIds.map((id) => tr(c, `get_plan/${id}`, {}, refresh)));
  for (const p of plans)
    for (const e of p.entries ?? [])
      for (const r of e.runs ?? [])
        runs.set(r.id, { id: r.id, name: runLabel(r), config: r.config, suite_id: r.suite_id, plan_id: p.id, plan_name: p.name });
  const singles = await Promise.all(runIds.filter((id) => !runs.has(id)).map((id) => tr(c, `get_run/${id}`, {}, refresh)));
  for (const r of singles)
    runs.set(r.id, { id: r.id, name: runLabel(r), config: r.config, suite_id: r.suite_id, plan_id: r.plan_id ?? null, plan_name: null });
  return { plans, runs: [...runs.values()] };
}

/** All tests of the given runs, normalised, with section and latest-result timestamp attached. */
export async function loadTests(c: Creds, projectId: number, runs: RunMeta[], refresh: boolean) {
  const suiteIds = [...new Set(runs.map((r) => r.suite_id ?? 0))];
  const [perRun, perSuite] = await Promise.all([
    Promise.all(
      runs.map((r) =>
        Promise.all([tr<any[]>(c, `get_tests/${r.id}`, {}, refresh), tr<any[]>(c, `get_results_for_run/${r.id}`, {}, refresh)]),
      ),
    ),
    Promise.all(
      suiteIds.map((s) =>
        Promise.all([
          tr<any[]>(c, `get_cases/${projectId}`, { suite_id: s || undefined }, refresh),
          tr<any[]>(c, `get_sections/${projectId}`, { suite_id: s || undefined }, refresh),
        ]),
      ),
    ),
  ]);

  const caseSection = new Map<number, number>();
  const sections: { id: number; name: string; parent_id: number | null }[] = [];
  for (const [cases, secs] of perSuite) {
    for (const k of cases) caseSection.set(k.id, k.section_id);
    sections.push(...secs.map((s: any) => ({ id: s.id, name: s.name, parent_id: s.parent_id })));
  }

  const tests: Test[] = [];
  runs.forEach((r, i) => {
    const [rt, results] = perRun[i];
    const latest = new Map<number, number>();
    for (const x of results) if (x.status_id && x.created_on > (latest.get(x.test_id) ?? 0)) latest.set(x.test_id, x.created_on);
    for (const t of rt) {
      const custom: Record<string, unknown> = {};
      for (const k in t) if (k.startsWith("custom_")) custom[k] = t[k];
      tests.push({
        id: t.id,
        case_id: t.case_id,
        title: t.title,
        status_id: t.status_id,
        run_id: r.id,
        run_name: r.name,
        plan_id: r.plan_id,
        plan_name: r.plan_name,
        suite_id: r.suite_id,
        section_id: t.section_id ?? caseSection.get(t.case_id) ?? null,
        priority_id: t.priority_id ?? null,
        type_id: t.type_id ?? null,
        refs: t.refs ?? null,
        latest: latest.get(t.id) ?? 0,
        custom,
      });
    }
  });
  return { tests, sections };
}
