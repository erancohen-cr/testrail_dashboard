import { TestRailError } from "./testrail";

/** Wrap a route body: JSON out, errors mapped to a readable status + message. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : Response.json(out);
  } catch (e) {
    const status = e instanceof TestRailError ? (e.status === 401 || e.status === 403 ? e.status : 502) : 500;
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
