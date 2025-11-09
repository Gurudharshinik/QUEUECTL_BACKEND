// src/worker.js
import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { sleep, calculateBackoff, nowISO } from './util.js';
import { getConfigInt } from './config.js';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNTIME_PATH = path.resolve(__dirname, '..', 'runtime', 'workers.json');
const RUNTIME_DIR = path.dirname(RUNTIME_PATH);
if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });

// Helper to pick next pending job (locked transactionally)
function fetchNextJob(workerId) {
  const tx = db.transaction(() => {
    const job = db
      .prepare("SELECT * FROM jobs WHERE state = 'pending' ORDER BY created_at LIMIT 1")
      .get();
    if (!job) return null;

    db.prepare(
      "UPDATE jobs SET state='processing', locked_by=?, locked_at=?, updated_at=? WHERE id=?"
    ).run(workerId, nowISO(), nowISO(), job.id);
    return job;
  });
  return tx();
}

async function processJob(job, workerId) {
  console.log(`[Worker ${workerId}] Executing job ${job.id}: ${job.command}`);

  return new Promise((resolve) => {
    const child = spawn(job.command, {
      shell: true,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      resolve(code === 0);
    });
  });
}

async function workerLoop(workerId, stopFlag) {
  console.log(`[Worker ${workerId}] Started`);

  while (!stopFlag.stop) {
    const job = fetchNextJob(workerId);
    if (!job) {
      await sleep(2000); // idle wait
      continue;
    }

    const success = await processJob(job, workerId);
    const now = nowISO();

    if (success) {
      db.prepare("UPDATE jobs SET state='completed', updated_at=? WHERE id=?").run(now, job.id);
      console.log(`[Worker ${workerId}] ✅ Job ${job.id} completed`);
    } else {
      const maxRetries = job.max_retries || getConfigInt('max_retries') || 3;
      const attempts = job.attempts + 1;
      if (attempts >= maxRetries) {
        db.prepare("UPDATE jobs SET state='dead', updated_at=?, last_error=? WHERE id=?")
          .run(now, 'Max retries reached', job.id);
        console.log(`[Worker ${workerId}] ❌ Job ${job.id} moved to DLQ`);
      } else {
        const base = getConfigInt('backoff_base') || 2;
        const delay = calculateBackoff(base, attempts);

        db.prepare(
          "UPDATE jobs SET state='failed', attempts=?, updated_at=?, last_error=? WHERE id=?"
        ).run(attempts, now, `Retry in ${delay / 1000}s`, job.id);

        console.log(`[Worker ${workerId}] ⚠️ Job ${job.id} failed (retry in ${delay / 1000}s)`);
        setTimeout(() => {
          db.prepare("UPDATE jobs SET state='pending', updated_at=? WHERE id=?")
            .run(nowISO(), job.id);
        }, delay);
      }
    }
  }

  console.log(`[Worker ${workerId}] Stopped`);
}

export async function startWorkers(count = os.cpus().length) {
  const workers = [];
  const stopFlag = { stop: false };

  for (let i = 0; i < count; i++) {
    workerLoop(i + 1, stopFlag); // fire async loop
    workers.push(i + 1);
  }

  fs.writeFileSync(RUNTIME_PATH, JSON.stringify({ pids: workers, started_at: nowISO() }, null, 2));
  console.log(`🚀 Started ${count} worker(s)`);
}

export async function stopWorkers() {
  if (fs.existsSync(RUNTIME_PATH)) {
    fs.unlinkSync(RUNTIME_PATH);
    console.log('🛑 Workers stopped');
  } else {
    console.log('No active workers found.');
  }
}
