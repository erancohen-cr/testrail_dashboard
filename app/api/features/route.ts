import { db, listFeatures } from "@/lib/db";
import { handle } from "@/lib/http";

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : d);
const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []);

export async function GET(req: Request) {
  return handle(async () => listFeatures(Number(new URL(req.url).searchParams.get("project_id"))));
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await req.json();
    const name = String(b.name ?? "").trim();
    const projectId = Number(b.project_id);
    if (!name || !Number.isInteger(projectId)) return Response.json({ error: "name and project are required" }, { status: 400 });
    const common = [projectId, name, String(b.description ?? ""), num(b.green, 90), num(b.amber, 70)];
    if (b.kind === "suite") {
      const payload = JSON.stringify(ids(b.feature_ids));
      if (b.id) db.prepare("UPDATE feature_suites SET project_id=?, name=?, description=?, green=?, amber=?, feature_ids=?, updated_at=datetime('now') WHERE id=?").run(...common, payload, Number(b.id));
      else db.prepare("INSERT INTO feature_suites (project_id, name, description, green, amber, feature_ids) VALUES (?,?,?,?,?,?)").run(...common, payload);
    } else {
      const d = b.def ?? {};
      const f = d.filters ?? {};
      const def = JSON.stringify({
        planIds: ids(d.planIds), runIds: ids(d.runIds), suiteIds: ids(d.suiteIds), sectionIds: ids(d.sectionIds),
        filters: {
          titleContains: String(f.titleContains ?? ""), refsContains: String(f.refsContains ?? ""),
          priorityIds: ids(f.priorityIds), typeIds: ids(f.typeIds),
          customField: f.customField?.name ? { name: String(f.customField.name), value: String(f.customField.value ?? "") } : undefined,
        },
      });
      if (b.id) db.prepare("UPDATE features SET project_id=?, name=?, description=?, green=?, amber=?, def=?, updated_at=datetime('now') WHERE id=?").run(...common, def, Number(b.id));
      else db.prepare("INSERT INTO features (project_id, name, description, green, amber, def) VALUES (?,?,?,?,?,?)").run(...common, def);
    }
    return listFeatures(projectId);
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    db.prepare(`DELETE FROM ${q.get("kind") === "suite" ? "feature_suites" : "features"} WHERE id = ?`).run(Number(q.get("id")));
    return listFeatures(Number(q.get("project_id")));
  });
}
