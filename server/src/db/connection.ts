/**
 * SQLite connection (bun:sqlite). The database lives at DATA_DIR/voidboard.db
 * so data persists across restarts — boards are always there after a reboot.
 *
 * The schema is applied synchronously at module load so every module that
 * imports `db` can prepare statements immediately (import order is safe).
 */

import { Database } from "bun:sqlite"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import config from "../config.js"

mkdirSync(config.dataDir, { recursive: true })

export const db = new Database(path.join(config.dataDir, "voidboard.db"))
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")

// Apply schema.sql — idempotent (all statements use IF NOT EXISTS).
const schema = readFileSync(path.join(import.meta.dir, "schema.sql"), "utf8")
db.exec(schema)

// One-off column migrations for databases created before a column existed.
// `CREATE TABLE IF NOT EXISTS` won't add columns, so patch them here.
const commentCols = db.query("PRAGMA table_info(comments)").all() as { name: string }[]
if (!commentCols.some((c) => c.name === "parent_id")) {
  db.exec("ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE;")
}
db.exec("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);")

db.exec("PRAGMA optimize;")

export function now(): number {
  return Date.now()
}