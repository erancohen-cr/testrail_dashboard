import { getCreds } from "@/lib/creds";
import { listFeatures } from "@/lib/db";
import { handle } from "@/lib/http";
import { resolveRuns, loadTests } from "@/lib/load";
import { dedupe, makeCard, matchFeature, stats, withDescendants, type Card, type Test } from "@/lib/aggregate";

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const projectId = Number(b.projectId);
    const planIds = ids(b.planIds), runIds = ids(b.runIds), featureIds = ids(b.featureIds), suiteIds = ids(b.suiteIds);
    const refresh = !!b.refresh;
    const creds = await getCreds();

    const { features, suites } = listFeatures(projectId);
    const selSuites = suites.filter((s) => suiteIds.includes(s.id));
    const neededFeatureIds = uniq([...featureIds, ...selSuites.flatMap((s) => s.feature_ids)]);
    const selFeatures = features.filter((f) => neededFeatureIds.includes(f.id));

    const { plans, runs } = await resolveRuns(
      creds,
      uniq([...planIds, ...selFeatures.flatMap((f) => f.def.planIds)]),
      uniq([...runIds, ...selFeatures.flatMap((f) => f.def.runIds)]),
      refresh,
    );
    const { tests, sections } = await loadTests(creds, projectId, runs, refresh);
    const secName = new Map(sections.map((s) => [s.id, s.name]));
    const sectionName = (id: number | null) => (id != null && secName.get(id)) || "(no section)";
    const caseCount = (ts: Test[]) => plural(new Set(ts.map((t) => t.case_id)).size, "test case");

    // Plans and runs: raw TestRail numbers (match TestRail's own pages). Features/suites/overall: de-duplicated by case.
    const planCards = plans
      .filter((p) => planIds.includes(p.id))
      .map((p) => {
        const ts = tests.filter((t) => t.plan_id === p.id);
        const runRows = runs
          .filter((r) => r.plan_id === p.id)
          .map((r) => ({ key: `run:${r.id}`, name: r.name, type: "run" as const, stats: stats(ts.filter((t) => t.run_id === r.id)) }));
        return makeCard({ id: `plan:${p.id}`, kind: "plan", name: p.name, sub: `${plural(runRows.length, "test run")} · ${caseCount(ts)}` }, ts, sectionName, 90, 70, runRows);
      });
    const runCards = runs
      .filter((r) => runIds.includes(r.id))
      .map((r) => {
        const ts = tests.filter((t) => t.run_id === r.id);
        return makeCard({ id: `run:${r.id}`, kind: "run", name: r.name, sub: caseCount(ts) }, ts, sectionName);
      });

    const featureTests = new Map<number, Test[]>();
    for (const f of selFeatures) {
      const set = f.def.sectionIds.length ? withDescendants(sections, f.def.sectionIds) : null;
      featureTests.set(f.id, dedupe(tests.filter((t) => matchFeature(t, f.def, set))));
    }
    const featureCards = selFeatures
      .filter((f) => featureIds.includes(f.id))
      .map((f) => {
        const ts = featureTests.get(f.id)!;
        const nRuns = new Set(ts.map((t) => t.run_id)).size;
        return makeCard({ id: `feature:${f.id}`, kind: "feature", name: f.name, sub: `${plural(nRuns, "test run")} · ${caseCount(ts)}` }, ts, sectionName, f.green, f.amber);
      });
    const suiteCards = selSuites.map((s) => {
      const members = selFeatures.filter((f) => s.feature_ids.includes(f.id));
      const ts = dedupe(members.flatMap((f) => featureTests.get(f.id)!));
      const rows = members.map((f) => ({ key: `feature:${f.id}`, name: f.name, stats: stats(featureTests.get(f.id)!) }));
      return makeCard({ id: `suite:${s.id}`, kind: "suite", name: s.name, sub: `${plural(members.length, "feature")} · ${caseCount(ts)}` }, ts, sectionName, s.green, s.amber, rows);
    });

    const cards: Card[] = [...suiteCards, ...featureCards, ...planCards, ...runCards];
    const inFeatures = new Set([...featureTests.values()].flat());
    const all = dedupe(tests.filter((t) => planIds.includes(t.plan_id ?? -1) || runIds.includes(t.run_id) || inFeatures.has(t)));
    const overall = makeCard({ id: "overall", kind: "overall", name: "Overall", sub: `${plural(cards.length, "scorecard")} · ${caseCount(all)}` }, all, sectionName);
    return { overall, cards, url: creds.url };
  });
}
