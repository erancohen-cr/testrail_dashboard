"use client";
import { useEffect, useState } from "react";

/** useState that survives reloads via localStorage (view/filter state only — nothing sensitive). */
export function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`trd:${key}`);
      if (raw != null) setV(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(`trd:${key}`, JSON.stringify(v)); } catch {}
  }, [key, v, ready]);
  return [v, setV, ready] as const;
}

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

/** Fetch on dependency change; returns [data, error, loading]. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!path });
  useEffect(() => {
    if (!path) return setState({ loading: false });
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path)
      .then((data) => live && setState({ data, loading: false }))
      .catch((e) => live && setState({ error: e.message, loading: false }));
    return () => { live = false; };
  }, [path]);
  return state;
}
