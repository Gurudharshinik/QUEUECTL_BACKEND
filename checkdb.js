// checkdb.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Needed for ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the SQLite database
const dbPath = path.resolve(__dirname, 'db', 'queue.db');
const db = new Database(dbPath);

console.log("✅ Connected to:", dbPath);

// Check Jobs
console.log("\n📋 Jobs table:");
try {
  const rows = db.prepare('SELECT id, command, state, attempts, created_at FROM jobs').all();
  if (rows.length === 0) {
    console.log("(no jobs found)");
  } else {
    console.table(rows);
  }
} catch (err) {
  console.error("❌ Error reading jobs:", err.message);
}

// Check Config
console.log("\n⚙️ Config table:");
try {
  const configs = db.prepare('SELECT key, value FROM config').all();
  console.table(configs);
} catch (err) {
  console.error("❌ Error reading config:", err.message);
}

db.close();
