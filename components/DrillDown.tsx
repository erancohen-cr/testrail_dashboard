"use client";
import { useEffect, useRef, useState } from "react";
import type { Card, Row } from "@/lib/aggregate";
import { statusName } from "@/lib/aggregate";
import { Bar, STATUS_TEXT } from "./ui";

const TABS = ["Plans & Runs", "Sections", "Tests"] as const;

function RowsTable({ rows, first, showType }: { rows: Row[]; first: string; showType?: boolean }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="th">{first}</th>
          {showType && <th className="th w-20">Type</th>}
          <th className="th w-36 text-right">Progress</th>
          <th className="th w-64">Breakdown</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="td">{r.name}</td>
            {showType && <td className="td"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.type}</span></td>}
            <td className="td text-right tabular-nums">{r.stats.pct}% ({r.stats.executed}/{r.stats.total})</td>
            <td className="td"><Bar s={r.stats} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DrillDown({ card, url, onClose }: { card: Card | null; url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Plans & Runs");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (card) ref.current?.showModal();
    else ref.current?.close();
  }, [card]);

  const tests = card?.tests.filter((t) => !q || `C${t.case_id} ${t.title} ${statusName(t.status_id)}`.toLowerCase().includes(q.toLowerCase())) ?? [];

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(1000px,95vw)] rounded-xl bg-white p-0 shadow-xl">
      {card && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between px-6 pt-5">
            <div>
              <h2 className="text-lg font-semibold">{card.name}</h2>
              <p className="text-xs text-slate-500">{card.stats.pct}% executed · {card.stats.executed} of {card.stats.total} tests</p>
            </div>
            <button className="text-xl leading-none text-slate-400 hover:text-slate-700" onClick={() => ref.current?.close()} aria-label="Close">×</button>
          </div>
          <div className="mx-6 mt-3 flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1 text-sm ${tab === t ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}>{t}</button>
            ))}
          </div>
          <div className="mt-3 overflow-auto px-6 pb-6">
            {tab === "Plans & Runs" && <RowsTable rows={card.bySource} first="Source" showType />}
            {tab === "Sections" && <RowsTable rows={card.bySection} first="Section" />}
            {tab === "Tests" && (
              <>
                <input className="input mb-2 max-w-xs" placeholder="Filter tests…" value={q} onChange={(e) => setQ(e.target.value)} />
                <table className="w-full">
                  <thead>
                    <tr><th className="th w-20">Case</th><th className="th">Title</th><th className="th w-24">Status</th><th className="th w-72">Run</th></tr>
                  </thead>
                  <tbody>
                    {tests.map((t) => {
                      const s = statusName(t.status_id);
                      return (
                        <tr key={t.id}>
                          <td className="td"><a className="text-accent hover:underline" href={`${url}/index.php?/cases/view/${t.case_id}`} target="_blank" rel="noreferrer">C{t.case_id}</a></td>
                          <td className="td">{t.title}</td>
                          <td className={`td capitalize ${STATUS_TEXT[s]}`}><a className="hover:underline" href={`${url}/index.php?/tests/view/${t.id}`} target="_blank" rel="noreferrer">{s}</a></td>
                          <td className="td text-slate-600">{t.run_name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
