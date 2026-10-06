import { getCreds } from "@/lib/creds";
import { handle } from "@/lib/http";
import { tr } from "@/lib/testrail";

// Read-only endpoints the browser may reach through this proxy.
const ALLOWED = new Set([
  "get_projects", "get_plans", "get_plan", "get_runs", "get_run", "get_suites", "get_sections",
  "get_cases", "get_users", "get_priorities", "get_case_types", "get_statuses", "get_case_fields",
]);

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(async () => {
    const path = (await params).path;
    if (!ALLOWED.has(path[0]) || path.length > 2 || (path[1] && !/^\d+$/.test(path[1]))) {
      return Response.json({ error: "endpoint not allowed" }, { status: 400 });
    }
    const q = Object.fromEntries(new URL(req.url).searchParams);
    const refresh = q.refresh === "1";
    delete q.refresh;
    return tr(await getCreds(), path.join("/"), q, refresh);
  });
}
