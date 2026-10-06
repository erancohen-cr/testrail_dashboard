"use client";
import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureSuite } from "@/lib/aggregate";
import { api, useApi, usePersisted } from "@/lib/client";
import { ErrorNote, ProjectSelect } from "@/components/ui";
import { FeatureForm, SuiteForm } from "@/components/FeatureForm";

type Data = { features: Feature[]; suites: FeatureSuite[] };
type Editing = { kind: "feature"; item?: Feature } | { kind: "suite"; item?: FeatureSuite } | null;

const describe = (f: Feature) => {
  const d = f.def;
  const parts = [`${d.planIds.length} plan(s)`, `${d.runIds.length} run(s)`];
  if (d.suiteIds.length) parts.push(`${d.suiteIds.length} suite(s)`);
  if (d.sectionIds.length) parts.push(`${d.sectionIds.length} section(s)`);
  return parts.join(", ");
};

export default function FeaturesPage() {
  const [projectId, setProjectId] = usePersisted<number | null>("project", null);
  const loaded = useApi<Data>(projectId ? `/api/features?project_id=${projectId}` : null);
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Editing>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => setData(loaded.data), [loaded.data]);
  useEffect(() => { if (editing) dlg.current?.showModal(); else dlg.current?.close(); }, [editing]);

  async function save(body: any) {
    try { setData(await api("/api/features", { method: "POST", json: body })); setEditing(null); }
    catch (e: any) { setError(e.message); }
  }
  async function remove(kind: "feature" | "suite", id: number, name: string) {
    if (!confirm(`Delete ${kind} "${name}"? This affects everyone on the team.`)) return;
    try { setData(await api(`/api/features?kind=${kind}&id=${id}&project_id=${projectId}`, { method: "DELETE" })); }
    catch (e: any) { setError(e.message); }
  }

  const featureName = new Map(data?.features.map((f) => [f.id, f.name]));
  const Item = ({ title, sub, onEdit, onDelete }: { title: string; sub: string; onEdit: () => void; onDelete: () => void }) => (
    <div className="card flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate font-semibold" title={title}>{title}</div>
        <div className="mt-1 text-xs text-slate-500">{sub}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onEdit} title="Edit">Edit</button>
        <button className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50" onClick={onDelete} title="Delete">Delete</button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Features</h1>
          <p className="text-sm text-slate-500">Shared with your whole team. Each feature and feature suite becomes one scorecard.</p>
        </div>
        <div className="flex gap-2">
          <div className="w-56"><ProjectSelect value={projectId} onChange={setProjectId} /></div>
          <button className="btn-ghost whitespace-nowrap" disabled={!projectId} onClick={() => setEditing({ kind: "suite" })}>+ New feature suite</button>
          <button className="btn whitespace-nowrap" disabled={!projectId} onClick={() => setEditing({ kind: "feature" })}>+ New feature</button>
        </div>
      </div>
      <ErrorNote msg={error ?? loaded.error} />

      {data && (
        <>
          <h2 className="mb-2 mt-4 text-sm font-semibold text-slate-600">Feature suites</h2>
          {!data.suites.length && <p className="text-sm text-slate-400">No feature suites yet.</p>}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.suites.map((s) => (
              <Item key={s.id} title={s.name}
                sub={`${s.feature_ids.map((id) => featureName.get(id) ?? "(deleted)").join(", ")} · green ≥ ${s.green}%, amber ≥ ${s.amber}%`}
                onEdit={() => setEditing({ kind: "suite", item: s })} onDelete={() => remove("suite", s.id, s.name)} />
            ))}
          </div>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-600">Features</h2>
          {!data.features.length && <p className="text-sm text-slate-400">No features yet.</p>}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.features.map((f) => (
              <Item key={f.id} title={f.name} sub={`${describe(f)} · green ≥ ${f.green}%, amber ≥ ${f.amber}%`}
                onEdit={() => setEditing({ kind: "feature", item: f })} onDelete={() => remove("feature", f.id, f.name)} />
            ))}
          </div>
        </>
      )}

      <dialog ref={dlg} onClose={() => setEditing(null)} className={`m-auto rounded-xl bg-white p-6 shadow-xl ${editing?.kind === "suite" ? "w-[min(520px,95vw)]" : "w-[min(1100px,95vw)]"}`}>
        {editing && projectId && (
          <>
            <h2 className="mb-4 text-lg font-semibold">{editing.item ? "Edit" : "New"} {editing.kind === "suite" ? "feature suite" : "feature"}</h2>
            {editing.kind === "feature"
              ? <FeatureForm key={editing.item?.id ?? "new"} projectId={projectId} initial={editing.item} onSave={save} onCancel={() => setEditing(null)} />
              : <SuiteForm key={editing.item?.id ?? "new"} projectId={projectId} features={data?.features ?? []} initial={editing.item} onSave={save} onCancel={() => setEditing(null)} />}
          </>
        )}
      </dialog>
    </main>
  );
}
