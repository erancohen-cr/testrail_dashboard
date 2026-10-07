"use client";
import { useState } from "react";
import type { Feature, FeatureDef, FeatureSuite } from "@/lib/aggregate";
import { useApi } from "@/lib/client";
import { Checks } from "./ui";

const EMPTY_DEF: FeatureDef = { planIds: [], runIds: [], suiteIds: [], sectionIds: [], filters: {} };

function Thresholds({ v, set }: { v: { green: number; amber: number }; set: (p: { green?: number; amber?: number }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className="label">Green at or above (%)</label><input type="number" min={0} max={100} className="input" value={v.green} onChange={(e) => set({ green: Number(e.target.value) })} /></div>
      <div><label className="label">Amber at or above (%)</label><input type="number" min={0} max={100} className="input" value={v.amber} onChange={(e) => set({ amber: Number(e.target.value) })} /></div>
    </div>
  );
}

const Box = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <div className="label">{title}</div>
    <div className="max-h-44 overflow-auto rounded-md border border-slate-200 p-2">{children}</div>
  </div>
);

export function FeatureForm({ projectId, initial, onSave, onCancel }: { projectId: number; initial?: Feature; onSave: (body: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: "", description: "", green: 90, amber: 70, ...initial, planIds: initial?.def.planIds ?? [], runIds: initial?.def.runIds ?? [] });

  // Source list narrowing (not saved): assignee, title, completed.
  const [listQ, setListQ] = useState({ assignee: "", title: "", completed: false });
  const plans = useApi<any[]>(`/api/tr/get_plans/${projectId}`);
  const runs = useApi<any[]>(`/api/tr/get_runs/${projectId}`);
  const users = useApi<any[]>(`/api/tr/get_users/${projectId}`);

  const narrow = (items: any[] | undefined, chosen: number[]) =>
    (items ?? [])
      .filter((i) => chosen.includes(i.id) || (
        (listQ.completed || !i.is_completed) &&
        (!listQ.assignee || String(i.assignedto_id) === listQ.assignee) &&
        (!listQ.title || i.name.toLowerCase().includes(listQ.title.toLowerCase()))
      ))
      .map((i) => ({ id: i.id as number, name: i.name as string }));

  // A feature is its plans + runs; suite/section/case filters are no longer set from the form.
  const def: FeatureDef = { ...EMPTY_DEF, planIds: f.planIds, runIds: f.runIds };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); onSave({ kind: "feature", id: initial?.id, project_id: projectId, name: f.name, description: f.description, green: f.green, amber: f.amber, def }); }}
    >
      <div><label className="label">Name</label><input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Description</label><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Thresholds v={f} set={(p) => setF({ ...f, ...p })} />

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium">Sources</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <select className="input" value={listQ.assignee} onChange={(e) => setListQ({ ...listQ, assignee: e.target.value })}>
            <option value="">Any assignee</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="input" placeholder="Name contains…" value={listQ.title} onChange={(e) => setListQ({ ...listQ, title: e.target.value })} />
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={listQ.completed} onChange={(e) => setListQ({ ...listQ, completed: e.target.checked })} /> Include completed
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Box title={`Test Plans (${f.planIds.length})`}>
            <Checks options={narrow(plans.data, f.planIds)} value={f.planIds} onChange={(v) => setF({ ...f, planIds: v })} />
          </Box>
          <Box title={`Test Runs (${f.runIds.length})`}>
            <Checks options={narrow(runs.data, f.runIds)} value={f.runIds} onChange={(v) => setF({ ...f, runIds: v })} />
          </Box>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={!f.name.trim() || (!f.planIds.length && !f.runIds.length)}>Save Feature</button>
      </div>
    </form>
  );
}

export function SuiteForm({ projectId, features, initial, onSave, onCancel }: { projectId: number; features: Feature[]; initial?: FeatureSuite; onSave: (body: any) => void; onCancel: () => void }) {
  const [s, setS] = useState({ name: "", description: "", green: 90, amber: 70, feature_ids: [] as number[], ...initial });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ kind: "suite", id: initial?.id, project_id: projectId, ...s }); }}>
      <div><label className="label">Name</label><input required className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
      <div><label className="label">Description</label><textarea className="input" rows={2} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></div>
      <Thresholds v={s} set={(p) => setS({ ...s, ...p })} />
      <Box title={`Features (${s.feature_ids.length})`}>
        {features.length ? <Checks options={features} value={s.feature_ids} onChange={(v) => setS({ ...s, feature_ids: v })} /> : <p className="text-xs text-slate-400">Create features first.</p>}
      </Box>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={!s.name.trim() || !s.feature_ids.length}>Save Suite</button>
      </div>
    </form>
  );
}
