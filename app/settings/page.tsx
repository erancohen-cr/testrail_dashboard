"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { ErrorNote } from "@/components/ui";

type Conn = { personal: boolean; email: string; url: string; name?: string };

export default function Settings() {
  const [conn, setConn] = useState<Conn>();
  const [form, setForm] = useState({ url: "", email: "", key: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  useEffect(() => {
    api<Conn>("/api/connection")
      .then((c) => { setConn(c); setForm({ url: c.url, email: c.personal ? c.email : "", key: "" }); })
      .catch((e) => setMsg({ err: e.message }));
  }, []);

  async function run(p: Promise<Conn>, ok: string) {
    setBusy(true); setMsg({});
    try {
      const c = await p;
      setConn(c);
      setForm((f) => ({ ...f, key: "" }));
      setMsg({ ok });
    } catch (e: any) {
      setMsg({ err: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-lg font-semibold">Your TestRail connection</h1>
      <p className="mt-1 text-sm text-slate-600">
        By default the dashboard reads TestRail through a shared readonly account. You can use your own account instead. Your API key is stored encrypted in an httpOnly cookie and never sent back to the browser.
      </p>
      <form
        className="card mt-6 space-y-4 p-6"
        onSubmit={(e) => { e.preventDefault(); run(api("/api/connection", { method: "POST", json: form }), "Connection works, saved."); }}
      >
        <div className="text-sm">
          Currently using{" "}
          <b>{conn ? (conn.personal ? `your account (${conn.email})` : `the shared readonly account (${conn.email})`) : "…"}</b>
        </div>
        <div>
          <label className="label" htmlFor="url">TestRail address</label>
          <input id="url" className="input" placeholder="https://yourcompany.testrail.io" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="email">TestRail email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="key">API key <span className="font-normal text-slate-400">(TestRail: My Settings → API Keys → Add Key)</span></label>
          <input id="key" type="password" autoComplete="off" className="input" placeholder={conn?.personal ? "•••••••• (saved)" : ""} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled={busy || !form.url || !form.email}>Test and save</button>
          {conn?.personal && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(api("/api/connection", { method: "DELETE" }), "Switched back to the readonly account.")}>
              Use readonly account
            </button>
          )}
        </div>
        {msg.ok && <div className="text-sm text-green-700">{msg.ok}</div>}
        <ErrorNote msg={msg.err} />
      </form>
    </main>
  );
}
