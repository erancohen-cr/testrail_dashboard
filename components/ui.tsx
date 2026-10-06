"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Stats } from "@/lib/aggregate";
import { useApi } from "@/lib/client";

export const STATUS_COLORS = {
  passed: "bg-green-600",
  failed: "bg-red-600",
  blocked: "bg-orange-500",
  retest: "bg-yellow-400",
  other: "bg-violet-500",
  untested: "bg-slate-300",
} as const;
export const STATUS_TEXT: Record<string, string> = {
  passed: "text-green-700",
  failed: "text-red-700",
  blocked: "text-orange-600",
  retest: "text-yellow-700",
  other: "text-violet-700",
  untested: "text-slate-500",
};
export const BAND_TEXT = { green: "text-green-700", amber: "text-amber-600", red: "text-red-700" } as const;

export function Nav() {
  const path = usePathname();
  const items = [
    ["/status", "Status"],
    ["/features", "Features"],
    ["/review", "Test review"],
    ["/settings", "Settings"],
  ];
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-1 border-b border-slate-200 bg-white px-4">
      <Link href="/" className="mr-4 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded bg-accent text-[10px] font-bold text-white">TR</span>
        Test Status Reporter
      </Link>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={`rounded px-3 py-1.5 text-sm ${path.startsWith(href) ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900"}`}>
          {label}
        </Link>
      ))}
    </header>
  );
}

export function Bar({ s, className = "h-2" }: { s: Stats; className?: string }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-200 ${className}`} title={`${s.executed}/${s.total} executed`}>
      {s.total > 0 &&
        (Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((k) =>
          s[k] ? <div key={k} className={STATUS_COLORS[k]} style={{ width: `${(s[k] / s.total) * 100}%` }} /> : null,
        )}
    </div>
  );
}

export function Legend({ s }: { s: Stats }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
      {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((k) => (
        <span key={k} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[k]}`} />
          <span className="capitalize">{k}</span> <b className="font-semibold text-slate-800">{s[k]}</b>
        </span>
      ))}
    </div>
  );
}

export function ProjectSelect({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const { data, error } = useApi<any[]>("/api/tr/get_projects");
  if (error) return <span className="text-sm text-red-700">{error}</span>;
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="" disabled>{data ? "Select project…" : "Loading…"}</option>
      {data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function Checks<T extends string | number>({ options, value, onChange }: { options: { id: T; name: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <>
      {options.map((o) => (
        <label key={o.id} className="flex items-start gap-2 py-0.5 text-sm">
          <input type="checkbox" className="mt-0.5" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
          <span>{o.name}</span>
        </label>
      ))}
    </>
  );
}

export function ErrorNote({ msg }: { msg?: string }) {
  return msg ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</div> : null;
}
