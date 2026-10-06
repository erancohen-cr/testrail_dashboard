"use client";
import { useMemo } from "react";

export type Section = { id: number; name: string; parent_id: number | null; display_order?: number };

type Props = {
  sections: Section[];
  expanded: number[];
  setExpanded: (v: number[]) => void;
  counts?: Map<number, number>; // recursive case counts per section
  checked?: number[]; // checkbox mode
  onCheck?: (v: number[]) => void;
  active?: number | null; // select mode
  onSelect?: (id: number) => void;
};

export function childrenMap(sections: Section[]) {
  const m = new Map<number | null, Section[]>();
  for (const s of sections) m.set(s.parent_id ?? null, [...(m.get(s.parent_id ?? null) ?? []), s]);
  for (const list of m.values()) list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return m;
}

/** Case counts per section including all sub-sections. */
export function recursiveCounts(sections: Section[], cases: { section_id: number }[]) {
  const own = new Map<number, number>();
  for (const c of cases) own.set(c.section_id, (own.get(c.section_id) ?? 0) + 1);
  const kids = childrenMap(sections);
  const out = new Map<number, number>();
  const walk = (s: Section): number => {
    const n = (own.get(s.id) ?? 0) + (kids.get(s.id) ?? []).reduce((a, k) => a + walk(k), 0);
    out.set(s.id, n);
    return n;
  };
  (kids.get(null) ?? []).forEach(walk);
  return out;
}

export function SectionTree({ sections, expanded, setExpanded, counts, checked, onCheck, active, onSelect }: Props) {
  const kids = useMemo(() => childrenMap(sections), [sections]);
  const node = (s: Section, depth: number) => {
    const sub = kids.get(s.id) ?? [];
    const open = expanded.includes(s.id);
    return (
      <li key={s.id}>
        <div
          className={`flex items-center gap-1 rounded py-0.5 pr-2 text-sm ${active === s.id ? "bg-accent/10 font-medium text-accent" : "hover:bg-slate-50"} ${onSelect ? "cursor-pointer" : ""}`}
          style={{ paddingLeft: depth * 14 }}
          onClick={() => onSelect?.(s.id)}
        >
          <button
            type="button"
            className={`w-4 shrink-0 text-xs text-slate-400 ${sub.length ? "" : "invisible"}`}
            onClick={(e) => { e.stopPropagation(); setExpanded(open ? expanded.filter((x) => x !== s.id) : [...expanded, s.id]); }}
          >
            {open ? "▾" : "▸"}
          </button>
          {checked && (
            <input
              type="checkbox"
              checked={checked.includes(s.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onCheck?.(e.target.checked ? [...checked, s.id] : checked.filter((x) => x !== s.id))}
            />
          )}
          <span className="min-w-0 flex-1 truncate" title={s.name}>{s.name}</span>
          {counts && <span className="text-xs tabular-nums text-slate-400">{counts.get(s.id) ?? 0}</span>}
        </div>
        {open && sub.length > 0 && <ul>{sub.map((k) => node(k, depth + 1))}</ul>}
      </li>
    );
  };
  return <ul>{(kids.get(null) ?? []).map((s) => node(s, 0))}</ul>;
}
