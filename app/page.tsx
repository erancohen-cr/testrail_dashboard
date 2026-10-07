import Link from "next/link";

const tiles = [
  ["Scorecards", "Testing progress per plan, run, feature and feature suite, combined across every selection."],
  ["Drill-Down", "Click a card to see the contribution of each plan, run, section and test."],
  ["Test Review", "Browse the section tree with counts and read test cases in a clean table."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">TestRail reporting</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Executive Test Status, Straight From TestRail</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Select any mix of test plans, test runs, features and feature suites, and get testing-progress scorecards you can drill into, plus a tabular view of the test cases themselves.
      </p>
      <Link href="/status" className="btn mt-8 px-5 py-2">Get Started</Link>
      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {tiles.map(([t, d]) => (
          <div key={t} className="card p-5">
            <h2 className="text-sm font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
