"use client";
import { Fragment, useMemo, useState } from "react";
import { withDescendants } from "@/lib/aggregate";
import { useApi, usePersisted } from "@/lib/client";
import { ErrorNote, ProjectSelect } from "@/components/ui";
import { SectionTree, recursiveCounts, type Section } from "@/components/SectionTree";

type Col = { key: string; label: string; get: (c: any) => string | number };
const fmtDate = (s?: number) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : "");
const automationKey = (c: any) => Object.keys(c).find((k) => /^custom_.*automat/i.test(k));

function Steps({ c }: { c: any }) {
  const block = (label: string, text?: string) =>
    text ? (
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="whitespace-pre-wrap text-sm">{text}</div>
      </div>
    ) : null;
  const sep: { content?: string; expected?: string }[] | undefined = c.custom_steps_separated;
  return (
    <div className="space-y-3 bg-slate-50 px-6 py-4">
      {block("Preconditions", c.custom_preconds)}
      {sep?.length ? (
        <table className="w-full">
          <thead><tr><th className="th w-10">#</th><th className="th">Step</th><th className="th">Expected result</th></tr></thead>
          <tbody>
            {sep.map((s, i) => (
              <tr key={i} className="align-top">
                <td className="td text-slate-400">{i + 1}</td>
                <td className="td whitespace-pre-wrap">{s.content}</td>
                <td className="td whitespace-pre-wrap">{s.expected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {block("Steps", c.custom_steps)}
          {block("Expected result", c.custom_expected)}
        </>
      )}
      {!c.custom_preconds && !sep?.length && !c.custom_steps && !c.custom_expected && <p className="text-sm text-slate-400">No steps recorded.</p>}
    </div>
  );
}

export default function ReviewPage() {
  const [projectId, setProjectId] = usePersisted<number | null>("project", null);
  const [suiteId, setSuiteId] = usePersisted<number | null>("review.suite", null);
  const [expanded, setExpanded] = usePersisted<number[]>("review.expanded", []);
  const [cols, setCols] = usePersisted<string[]>("review.cols", ["section", "priority", "type", "refs"]);
  const [filters, setFilters] = usePersisted("review.filters", { q: "", priority: "", type: "" });
  const [sort, setSort] = usePersisted<{ key: string; dir: 1 | -1 }>("review.sort", { key: "id", dir: 1 });
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState<number[]>([]);

  const suites = useApi<any[]>(projectId ? `/api/tr/get_suites/${projectId}` : null);
  const sid = suiteId && suites.data?.some((s) => s.id === suiteId) ? suiteId : suites.data?.[0]?.id;
  const sections = useApi<Section[]>(projectId && sid ? `/api/tr/get_sections/${projectId}?suite_id=${sid}` : null);
  const cases = useApi<any[]>(projectId && sid ? `/api/tr/get_cases/${projectId}?suite_id=${sid}` : null);
  const users = useApi<any[]>(projectId ? `/api/tr/get_users/${projectId}` : null);
  const priorities = useApi<any[]>("/api/tr/get_priorities");
  const types = useApi<any[]>("/api/tr/get_case_types");

  const lookup = useMemo(() => ({
    section: new Map(sections.data?.map((s) => [s.id, s.name])),
    user: new Map(users.data?.map((u) => [u.id, u.name])),
    priority: new Map(priorities.data?.map((p) => [p.id, p.name])),
    type: new Map(types.data?.map((t) => [t.id, t.name])),
  }), [sections.data, users.data, priorities.data, types.data]);

  const ALL_COLS: Col[] = [
    { key: "section", label: "Section", get: (c) => lookup.section.get(c.section_id) ?? "" },
    { key: "priority", label: "Priority", get: (c) => lookup.priority.get(c.priority_id) ?? "" },
    { key: "type", label: "Type", get: (c) => lookup.type.get(c.type_id) ?? "" },
    { key: "owner", label: "Owner", get: (c) => lookup.user.get(c.created_by) ?? "" },
    { key: "refs", label: "References", get: (c) => c.refs ?? "" },
    { key: "automation", label: "Automation", get: (c) => { const k = automationKey(c); return k ? String(c[k] ?? "") : ""; } },
    { key: "updated", label: "Updated", get: (c) => fmtDate(c.updated_on) },
  ];
  const shown = [{ key: "id", label: "ID", get: (c: any) => c.id }, { key: "title", label: "Title", get: (c: any) => c.title }, ...ALL_COLS.filter((c) => cols.includes(c.key))];

  const counts = useMemo(() => recursiveCounts(sections.data ?? [], cases.data ?? []), [sections.data, cases.data]);
  const rows = useMemo(() => {
    const inSection = active ? withDescendants(sections.data ?? [], [active]) : null;
    const q = filters.q.trim().toLowerCase().replace(/^c(?=\d+$)/, "");
    const col = shown.find((c) => c.key === sort.key) ?? shown[0];
    return (cases.data ?? [])
      .filter((c) => (!inSection || inSection.has(c.section_id))
        && (!q || String(c.id) === q || c.title.toLowerCase().includes(q))
        && (!filters.priority || String(c.priority_id) === filters.priority)
        && (!filters.type || String(c.type_id) === filters.type))
      .sort((a, b) => {
        const x = col.get(a), y = col.get(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
  }, [cases.data, sections.data, active, filters, sort, cols, lookup]);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [shown.map((c) => esc(c.label)).join(","), ...rows.map((r) => shown.map((c) => esc(c.key === "id" ? `C${r.id}` : c.get(r))).join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }));
    a.download = `test-cases-${sid}${active ? `-section-${active}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="flex h-[calc(100vh-3rem)] flex-col px-6 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Test case review</h1>
          <p className="text-sm text-slate-500">{rows.length} of {cases.data?.length ?? 0} cases</p>
        </div>
        <div className="flex gap-2">
          <div className="w-56"><ProjectSelect value={projectId} onChange={(id) => { setProjectId(id); setActive(null); }} /></div>
          <select className="input w-56" value={sid ?? ""} onChange={(e) => { setSuiteId(Number(e.target.value)); setActive(null); }}>
            {suites.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-ghost" disabled={!rows.length} onClick={exportCsv}>⇩ CSV</button>
        </div>
      </div>
      <ErrorNote msg={suites.error ?? sections.error ?? cases.error} />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="card w-72 shrink-0 overflow-auto p-2">
          <div
            className={`mb-1 flex cursor-pointer justify-between rounded px-2 py-0.5 text-sm ${active === null ? "bg-accent/10 font-medium text-accent" : "hover:bg-slate-50"}`}
            onClick={() => setActive(null)}
          >
            <span>All sections</span><span className="text-xs text-slate-400">{cases.data?.length ?? ""}</span>
          </div>
          {sections.loading ? <p className="p-2 text-xs text-slate-400">Loading…</p> : (
            <SectionTree sections={sections.data ?? []} expanded={expanded} setExpanded={setExpanded} counts={counts} active={active} onSelect={setActive} />
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <input className="input w-64" placeholder="Search by title or ID…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <select className="input w-36" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">Any priority</option>
              {priorities.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input w-40" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">Any type</option>
              {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {ALL_COLS.map((c) => (
              <label key={c.key} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setCols(e.target.checked ? [...cols, c.key] : cols.filter((k) => k !== c.key))} />
                {c.label}
              </label>
            ))}
          </div>
          <div className="card min-h-0 flex-1 overflow-auto">
            {cases.loading ? <p className="p-4 text-sm text-slate-400">Loading cases…</p> : (
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    {shown.map((c) => (
                      <th key={c.key} className="th cursor-pointer select-none hover:text-slate-800" onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (-sort.dir as 1 | -1) : 1 })}>
                        {c.label} {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isOpen = open.includes(r.id);
                    return (
                      <Fragment key={r.id}>
                        <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(isOpen ? open.filter((x) => x !== r.id) : [...open, r.id])}>
                          {shown.map((c) => (
                            <td key={c.key} className={`td ${c.key === "id" ? "whitespace-nowrap text-accent" : ""}`}>
                              {c.key === "id" ? <>{isOpen ? "▾" : "▸"} C{r.id}</> : c.get(r)}
                            </td>
                          ))}
                        </tr>
                        {isOpen && <tr><td colSpan={shown.length} className="border-b border-slate-200 p-0"><Steps c={r} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
