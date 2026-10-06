export type Creds = { url: string; email: string; key: string };

const TTL_MS = Number(process.env.CACHE_TTL_S ?? 300) * 1000;
// ponytail: in-process cache, move to Redis if the app runs as >1 replica
const cache = new Map<string, { exp: number; p: Promise<unknown> }>();

// Drop expired entries so keys nobody asks for again don't pile up in memory.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.exp <= now) cache.delete(k);
}, Math.max(TTL_MS, 60_000)).unref();

// Cap parallel TestRail requests per account so bursts queue instead of tripping the rate limit.
const MAX_PARALLEL = Number(process.env.TR_MAX_PARALLEL ?? 5);
const slots = new Map<string, { active: number; queue: (() => void)[] }>();

async function withSlot<T>(account: string, fn: () => Promise<T>): Promise<T> {
  let s = slots.get(account);
  if (!s) slots.set(account, (s = { active: 0, queue: [] }));
  if (s.active >= MAX_PARALLEL) await new Promise<void>((r) => s.queue.push(r));
  else s.active++;
  try {
    return await fn();
  } finally {
    const next = s.queue.shift();
    if (next) next(); // hand the slot straight to the next waiter
    else s.active--;
  }
}

const RETRY_STATUS = new Set([429, 503]);
const MAX_RETRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(creds: Creds, path: string): Promise<any> {
  const account = `${creds.url}|${creds.email}`;
  for (let attempt = 0; ; attempt++) {
    const res = await withSlot(account, () =>
      fetch(`${creds.url.replace(/\/$/, "")}/index.php?/api/v2/${path}`, {
        headers: {
          Authorization: "Basic " + Buffer.from(`${creds.email}:${creds.key}`).toString("base64"),
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }).catch(() => {
        throw new TestRailError(502, `Cannot reach TestRail at ${creds.url}`);
      }),
    );
    if (RETRY_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      // Honour Retry-After, else exponential backoff (1s, 2s, 4s, 8s) with jitter; capped at 30s.
      const after = Number(res.headers.get("Retry-After"));
      const ms = Number.isFinite(after) && res.headers.has("Retry-After") ? after * 1000 : 1000 * 2 ** attempt + Math.random() * 500;
      await sleep(Math.min(ms, 30_000));
      continue;
    }
    return parse(res);
  }
}

async function parse(res: Response) {
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body).error ?? body; } catch {}
    throw new TestRailError(res.status, msg.slice(0, 300));
  }
  return res.json();
}

export class TestRailError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
