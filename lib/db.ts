import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Feature, FeatureSuite } from "./aggregate";

const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });

// Reuse one handle across dev hot reloads.
const g = globalThis as unknown as { __db?: DatabaseSync };
export const db = (g.__db ??= new DatabaseSync(path.join(dir, "dashboard.db")));

db.exec(`
CREATE TABLE IF NOT EXISTS features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  green INTEGER NOT NULL DEFAULT 90,
  amber INTEGER NOT NULL DEFAULT 70,
  def TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS feature_suites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  green INTEGER NOT NULL DEFAULT 90,
  amber INTEGER NOT NULL DEFAULT 70,
  feature_ids TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function listFeatures(projectId: number) {
  const features = (db.prepare("SELECT * FROM features WHERE project_id = ? ORDER BY name").all(projectId) as any[]).map(
    (f) => ({ ...f, def: JSON.parse(f.def) }),
  ) as Feature[];
  const suites = (db.prepare("SELECT * FROM feature_suites WHERE project_id = ? ORDER BY name").all(projectId) as any[]).map(
    (s) => ({ ...s, feature_ids: JSON.parse(s.feature_ids) }),
  ) as FeatureSuite[];
  return { features, suites };
}

