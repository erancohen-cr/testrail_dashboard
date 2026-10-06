"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Card, Feature, FeatureSuite } from "@/lib/aggregate";
import { api, useApi, usePersisted } from "@/lib/client";
import { BAND_TEXT, Bar, Checks, ErrorNote, Legend, ProjectSelect } from "@/components/ui";
import { DrillDown } from "@/components/DrillDown";

type Sel = { planIds: number[]; runIds: number[]; featureIds: number[]; suiteIds: number[] };
const EMPTY: Sel = { planIds: [], runIds: [], featureIds: [], suiteIds: [] };
const SORTS = { default: "Default order", name: "Name", progress: "Progress (low first)", failed: "Most failed" } as const;
// Pill colours per entity kind; kept clear of the pass/fail status colours.
const KIND_PILL = {
  overall: ["Overall", "border-slate-300 bg-slate-100 text-slate-700"],
  suite: ["Suite", "border-violet-200 bg-violet-50 text-violet-700"],
  feature: ["Feature", "border-sky-200 bg-sky-50 text-sky-700"],
  plan: ["Plan", "border-teal-200 bg-teal-50 text-teal-700"],
  run: ["Run", "border-amber-200 bg-amber-50 text-amber-700"],
} as const;
const KIND_LABEL = { overall: "Overall progress", suite: "Suite progress", feature: "Feature progress", plan: "Plan progress", run: "Run progress" };

function Scorecard({ card, expanded, onToggle, onOpen }: { card: Card; expanded: boolean; onToggle?: () => void; onOpen: () => void }) {
  return (
    <div className="card">
      <div className="flex cursor-pointer items-center gap-6 p-4 hover:bg-slate-50" onClick={onOpen}>
        <div className="w-64 min-w-0">
          <span className={`mb-1 inline-block rounded-full border px-2 py-px text-[11px] font-medium ${KIND_PILL[card.kind][1]}`}>{KIND_PILL[card.kind][0]}</span>
          <div className="truncate font-semibold" title={card.name}>{card.name}</div>
          <div className="text-xs text-slate-500">{card.sub}</div>
        </div>
        <div className={`w-20 text-3xl font-bold tabular-nums ${BAND_TEXT[card.band]}`}>{card.stats.pct}%</div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs text-slate-500">
            {KIND_LABEL[card.kind]} · {card.stats.executed} of {card.stats.total} tests executed
          </div>
          <Bar s={card.stats} className="h-2.5" />
          <Legend s={card.stats} />
        </div>
        {onToggle && card.children.length > 0 && (
          <button
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label={expanded ? "Collapse" : "Expand"}
            title={expanded ? "Compact view" : "Extended view"}
          >
            {expanded ? "▴" : "▾"}
          </button>
        )}
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          {card.children.map((r) => (
            <div key={r.key} className="flex items-center gap-6 rounded-md border border-slate-100 px-3 py-2">
              <div className="w-60 truncate text-sm" title={r.name}>{r.name}</div>
              <div className="w-20 text-lg font-semibold tabular-nums">{r.stats.pct}%</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-xs text-slate-500">{r.stats.executed} of {r.stats.total} executed</div>
                <Bar s={r.stats} />
                <Legend s={r.stats} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatusPage() {
  const [projectId, setProjectId] = usePersisted<number | null>("project", null);
  const [sel, setSel, ready] = usePersisted<Sel>("status.sel", EMPTY);
  const [filter, setFilter] = usePersisted("status.filter", "");
  const [showCompleted, setShowCompleted] = usePersisted("status.completed", false);
  const [sort, setSort] = usePersisted<keyof typeof SORTS>("status.sort", "default");
  const [expanded, setExpanded] = usePersisted<string[]>("status.expanded", []);

  const pid = projectId ?? 0;
  const plans = useApi<any[]>(projectId ? `/api/tr/get_plans/${pid}` : null);
  const runs = useApi<any[]>(projectId ? `/api/tr/get_runs/${pid}` : null);
  const feats = useApi<{ features: Feature[]; suites: FeatureSuite[] }>(projectId ? `/api/features?project_id=${pid}` : null);

  const [result, setResult] = useState<{ overall: Card; cards: Card[]; url: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Card | null>(null);

  const nothing = !sel.planIds.length && !sel.runIds.length && !sel.featureIds.length && !sel.suiteIds.length;
  const selKey = JSON.stringify([pid, sel]);

  async function load(refresh = false) {
    if (!projectId || nothing) return setResult(undefined);
    setLoading(true); setError(undefined);
    try {
      setResult(await api("/api/scorecards", { method: "POST", json: { projectId, ...sel, refresh } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (ready) load(); }, [selKey, ready]);

  const match = (name: string) => name.toLowerCase().includes(filter.toLowerCase());
  const groups: [string, keyof Sel, { id: number; name: string }[] | undefined][] = [
    ["Feature suites", "suiteIds", feats.data?.suites],
    ["Features", "featureIds", feats.data?.features],
    ["Test plans", "planIds", plans.data?.filter((p) => showCompleted || !p.is_completed)],
    ["Test runs", "runIds", runs.data?.filter((r) => showCompleted || !r.is_completed)],
  ];

  const cards = useMemo(() => {
    const c = [...(result?.cards ?? [])];
    if (sort === "name") c.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "progress") c.sort((a, b) => a.stats.pct - b.stats.pct);
    if (sort === "failed") c.sort((a, b) => b.stats.failed - a.stats.failed);
    return c;
  }, [result, sort]);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <aside className="flex w-80 shrink-0 flex-col gap-3 border-r border-slate-200 bg-white p-4">
        <div>
          <label className="label">Project</label>
          <ProjectSelect value={projectId} onChange={(id) => { setProjectId(id); setSel(EMPTY); }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="label mb-0">Data sources</span>
          <span className="text-xs text-slate-500">{Object.values(sel).flat().length} selected</span>
        </div>
        <input className="input" placeholder="Filter plans, runs, features…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} /> Show completed plans & runs
        </label>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto rounded-md border border-slate-200 p-3">
          {!projectId && <p className="text-sm text-slate-500">Pick a project.</p>}
          {projectId && groups.map(([title, key, items]) => (
            <div key={key}>
              <div className="mb-1 text-xs font-semibold text-slate-500">{title}</div>
              {!items ? <p className="text-xs text-slate-400">Loading…</p>
                : !items.length ? <p className="text-xs text-slate-400">None</p>
                : <Checks options={items.filter((i) => match(i.name) || sel[key].includes(i.id))} value={sel[key]} onChange={(v) => setSel({ ...sel, [key]: v })} />}
            </div>
          ))}
          <ErrorNote msg={plans.error ?? runs.error ?? feats.error} />
        </div>
        <button className="btn-ghost" disabled={loading || nothing} onClick={() => load(true)}>
          {loading ? "Loading…" : "↻ Refresh results"}
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Test status</h1>
            <p className="text-sm text-slate-500">Suite, feature, plan and run progress</p>
          </div>
          <div className="flex gap-2">
            <select className="input w-48" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}
            </select>
            <Link href="/features" className="btn-ghost whitespace-nowrap">Configure features</Link>
          </div>
        </div>
        <ErrorNote msg={error} />
        {nothing && <p className="text-sm text-slate-500">Select plans, runs, features or feature suites on the left.</p>}
        {result && !nothing && (
          <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
            <Scorecard card={result.overall} expanded={false} onOpen={() => setOpen(result.overall)} />
            {cards.map((c) => (
              <Scorecard
                key={c.id}
                card={c}
                expanded={expanded.includes(c.id)}
                onToggle={c.kind === "plan" || c.kind === "suite" ? () => setExpanded(expanded.includes(c.id) ? expanded.filter((x) => x !== c.id) : [...expanded, c.id]) : undefined}
                onOpen={() => setOpen(c)}
              />
            ))}
          </div>
        )}
        {loading && !result && <p className="text-sm text-slate-500">Loading from TestRail…</p>}
      </main>
      <DrillDown card={open} url={result?.url ?? ""} onClose={() => setOpen(null)} />
    </div>
  );
}
