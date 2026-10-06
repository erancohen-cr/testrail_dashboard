"use client";
import { useState } from "react";
import type { Feature, FeatureDef, FeatureSuite } from "@/lib/aggregate";
import { useApi } from "@/lib/client";
import { Checks } from "./ui";
import { SectionTree, type Section } from "./SectionTree";

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
  const [f, setF] = useState({ name: "", description: "", green: 90, amber: 70, ...initial, def: { ...EMPTY_DEF, ...initial?.def, filters: { ...initial?.def.filters } } });
  const setDef = (p: Partial<FeatureDef>) => setF({ ...f, def: { ...f.def, ...p } });
  const setFilters = (p: Partial<FeatureDef["filters"]>) => setDef({ filters: { ...f.def.filters, ...p } });

  // Source list narrowing (not saved): assignee, title, completed.
  const [listQ, setListQ] = useState({ assignee: "", title: "", completed: false });
  const plans = useApi<any[]>(`/api/tr/get_plans/${projectId}`);
  const runs = useApi<any[]>(`/api/tr/get_runs/${projectId}`);
  const users = useApi<any[]>(`/api/tr/get_users/${projectId}`);
  const suites = useApi<any[]>(`/api/tr/get_suites/${projectId}`);
  const priorities = useApi<any[]>("/api/tr/get_priorities");
  const types = useApi<any[]>("/api/tr/get_case_types");

  const [treeSuite, setTreeSuite] = useState<number | null>(null);
  const suiteForTree = treeSuite ?? suites.data?.[0]?.id ?? null;
  const sections = useApi<Section[]>(suiteForTree ? `/api/tr/get_sections/${projectId}?suite_id=${suiteForTree}` : null);
  const [expanded, setExpanded] = useState<number[]>([]);

  const narrow = (items: any[] | undefined, chosen: number[]) =>
    (items ?? [])
      .filter((i) => chosen.includes(i.id) || (
        (listQ.completed || !i.is_completed) &&
        (!listQ.assignee || String(i.assignedto_id) === listQ.assignee) &&
        (!listQ.title || i.name.toLowerCase().includes(listQ.title.toLowerCase()))
      ))
      .map((i) => ({ id: i.id as number, name: i.name as string }));

  return (
    <form
      className="grid grid-cols-2 gap-6"
      onSubmit={(e) => { e.preventDefault(); onSave({ kind: "feature", id: initial?.id, project_id: projectId, ...f }); }}
    >
      <div className="space-y-3">
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
            <Box title={`Test plans (${f.def.planIds.length})`}>
              <Checks options={narrow(plans.data, f.def.planIds)} value={f.def.planIds} onChange={(v) => setDef({ planIds: v })} />
            </Box>
            <Box title={`Test runs (${f.def.runIds.length})`}>
              <Checks options={narrow(runs.data, f.def.runIds)} value={f.def.runIds} onChange={(v) => setDef({ runIds: v })} />
            </Box>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-medium">Case filters</div>
          <div className="mb-2 text-xs text-slate-500">Priority</div>
          <div className="flex flex-wrap gap-x-3"><Checks options={(priorities.data ?? []).map((p) => ({ id: p.id, name: p.short_name ?? p.name }))} value={f.def.filters.priorityIds ?? []} onChange={(v) => setFilters({ priorityIds: v })} /></div>
          <div className="mb-2 mt-3 text-xs text-slate-500">Case type</div>
          <div className="grid grid-cols-3 gap-x-3"><Checks options={(types.data ?? []).map((p) => ({ id: p.id, name: p.name }))} value={f.def.filters.typeIds ?? []} onChange={(v) => setFilters({ typeIds: v })} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input className="input" placeholder="Title contains…" value={f.def.filters.titleContains ?? ""} onChange={(e) => setFilters({ titleContains: e.target.value })} />
            <input className="input" placeholder="References contain…" value={f.def.filters.refsContains ?? ""} onChange={(e) => setFilters({ refsContains: e.target.value })} />
            <input className="input" placeholder="Custom field name" value={f.def.filters.customField?.name ?? ""} onChange={(e) => setFilters({ customField: { name: e.target.value, value: f.def.filters.customField?.value ?? "" } })} />
            <input className="input" placeholder="Custom field value" value={f.def.filters.customField?.value ?? ""} onChange={(e) => setFilters({ customField: { name: f.def.filters.customField?.name ?? "", value: e.target.value } })} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <Box title="Suites (empty = any)">
          <Checks options={(suites.data ?? []).map((s) => ({ id: s.id, name: s.name }))} value={f.def.suiteIds} onChange={(v) => setDef({ suiteIds: v })} />
        </Box>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex items-center justify-between">
            <span className="label mb-0">Sections ({f.def.sectionIds.length} selected)</span>
            <select className="input w-48" value={suiteForTree ?? ""} onChange={(e) => setTreeSuite(Number(e.target.value))}>
              {suites.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="min-h-64 flex-1 overflow-auto rounded-md border border-slate-200 p-2">
            {sections.loading ? <p className="text-xs text-slate-400">Loading…</p> : (
              <SectionTree sections={sections.data ?? []} expanded={expanded} setExpanded={setExpanded} checked={f.def.sectionIds} onCheck={(v) => setDef({ sectionIds: v })} />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Leave sections empty to include everything. A checked section includes its sub-sections.</p>
        </div>
        <div className="mt-auto flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" disabled={!f.name.trim() || (!f.def.planIds.length && !f.def.runIds.length)}>Save feature</button>
        </div>
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
        <button className="btn" disabled={!s.name.trim() || !s.feature_ids.length}>Save suite</button>
      </div>
    </form>
  );
}
