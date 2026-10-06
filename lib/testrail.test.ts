import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TR_MAX_PARALLEL = "3";
const { tr } = await import("./testrail.ts");
const creds = { url: "https://tr.example.test", email: "a@b.test", key: "k" };

test("caps parallel requests per account and retries 429", async () => {
  let active = 0, peak = 0, calls = 0;
  globalThis.fetch = (async (url: string) => {
    const n = ++calls;
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 10));
    active--;
    // First request for run 1 is rate-limited once.
    if (url.endsWith("get_run/1") && n === 1) return new Response("{}", { status: 429, headers: { "Retry-After": "0" } });
    return Response.json({ id: Number(url.split("/").pop()) });
  }) as typeof fetch;

  const out = await Promise.all(Array.from({ length: 10 }, (_, i) => tr(creds, `get_run/${i + 1}`)));
  assert.deepEqual(out.map((r) => r.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(peak, 3);
  assert.equal(calls, 11); // 10 + one retry

  // Cached: no new requests.
  await tr(creds, "get_run/1");
  assert.equal(calls, 11);
});
