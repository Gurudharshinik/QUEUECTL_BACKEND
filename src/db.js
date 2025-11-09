
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '..', 'db', 'queue.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Initialize schema 
db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scheduled_at TEXT,
  last_error TEXT,
  locked_by TEXT,
  locked_at TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Config initialization
const getConfigStmt = db.prepare('SELECT value FROM config WHERE key = ?');
const setConfigStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

function initDefaultConfig() {
  const defaults = {
    'max_retries': '3',
    'backoff_base': '2'
  };
  const tx = db.transaction(() => {
    for (const k of Object.keys(defaults)) {
      const row = getConfigStmt.get(k);
      if (!row) setConfigStmt.run(k, defaults[k]);
    }
  });
  tx();
}
initDefaultConfig();

// Job functions 
export function enqueueJob({ command, max_retries = 3 }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO jobs (id, command, state, max_retries, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?, ?)
  `);
  stmt.run(id, command, max_retries, now, now);
  return id;
}

export function getJobsByState(state) {
  const stmt = db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC');
  return stmt.all(state);
}

export function moveJobToPending(jobId) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`UPDATE jobs SET state='pending', updated_at=? WHERE id=?`);
  stmt.run(now, jobId);
}

export function getJobSummary() {
  const stmt = db.prepare(`
    SELECT state, COUNT(*) as count
    FROM jobs
    GROUP BY state
  `);
  return stmt.all();
}

// Config helpers
export function getConfig(key) {
  const row = getConfigStmt.get(key);
  return row ? row.value : null;
}

export function setConfig(key, value) {
  setConfigStmt.run(key, String(value));
}

// Exports
export { db, DB_PATH };
export default db;
