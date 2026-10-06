export type Creds = { url: string; email: string; key: string };

const TTL_MS = Number(process.env.CACHE_TTL_S ?? 300) * 1000;
// ponytail: in-process cache, move to Redis if the app runs as >1 replica
const cache = new Map<string, { exp: number; p: Promise<unknown> }>();

async function fetchJson(creds: Creds, path: string, retried = false): Promise<any> {
  const res = await fetch(`${creds.url.replace(/\/$/, "")}/index.php?/api/v2/${path}`, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${creds.email}:${creds.key}`).toString("base64"),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  }).catch(() => {
    throw new TestRailError(502, `Cannot reach TestRail at ${creds.url}`);
  });
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, Number(res.headers.get("Retry-After") ?? 5) * 1000));
    return fetchJson(creds, path, true);
  }
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body).error ?? body; } catch {}
    throw new TestRailError(res.status, msg.slice(0, 300));
  }
  return res.json();
}

export class TestRailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Paginated responses look like {offset, limit, size, _links, <items>: [...]}; any endpoint may use it.
const itemsKey = (d: any) => (d && !Array.isArray(d) && "_links" in d ? Object.keys(d).find((k) => Array.isArray(d[k])) : undefined);

async function load(creds: Creds, endpoint: string, query: string) {
  const data = await fetchJson(creds, `${endpoint}${query}`);
  const key = itemsKey(data);
  if (!key) return data; // bare array or single object
  const out = [...data[key]];
  let next: string | null = data._links?.next ?? null;
  while (next) {
    const page = await fetchJson(creds, next.replace(/^\/api\/v2\//, ""));
    out.push(...(page[key] ?? []));
    next = page._links?.next ?? null;
  }
  return out;
}

/** tr(creds, "get_runs/12", { suite_id: 3 }) — cached per (user, endpoint, params). */
export function tr<T = any>(
  creds: Creds,
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  refresh = false,
): Promise<T> {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
    .join("");
  const ck = `${creds.url}|${creds.email}|${endpoint}${query}`;
  const hit = cache.get(ck);
  if (!refresh && hit && hit.exp > Date.now()) return hit.p as Promise<T>;
  if (!endpoint.startsWith("get_")) throw new Error("read-only client: get_* endpoints only");
  const p = load(creds, endpoint, query);
  cache.set(ck, { exp: Date.now() + TTL_MS, p });
  p.catch(() => cache.delete(ck));
  return p as Promise<T>;
}
