
import { Command } from 'commander';
import fs from 'fs';
import { enqueueJob, getJobsByState, getJobSummary, moveJobToPending } from './db.js';
import { startWorkers, stopWorkers } from './worker.js';
import { getConfig, setConfig } from './config.js';
import { generateId } from './util.js';

const program = new Command();

program
  .name('queuectl')
  .description('CLI-based background job queue system')
  .version('1.0.0');


// for enqueue

program
  .command('enqueue')
  .description('Add a new job to the queue')
  .option('--command <cmd>', 'Shell command to execute for the job')
  .option('--max-retries <n>', 'Maximum retry attempts', '3')
  .action(async (opts) => {
    try {
      if (!opts.command) {
        console.error('Error: You must specify a command using --command "<cmd>"');
        process.exit(1);
      }

      const job = {
        id: generateId(),
        command: opts.command,
        state: 'pending',
        attempts: 0,
        max_retries: parseInt(opts.maxRetries || '3'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await enqueueJob(job);
      console.log(`✅ Enqueued job ${job.id}`);
    } catch (err) {
      console.error('❌ Failed to enqueue job:', err.message);
    }
  });


// For worker start and stop

const worker = program.command('worker').description('Manage workers');

worker
  .command('start')
  .option('--count <n>', 'Number of workers to start', '1')
  .description('Start worker(s)')
  .action(async (opts) => {
    const count = parseInt(opts.count || '1');
    await startWorkers(count);
  });

worker
  .command('stop')
  .description('Stop all running workers gracefully')
  .action(async () => {
    await stopWorkers();
  });


// For checking status

program
  .command('status')
  .description('Show summary of all job states & active workers')
  .action(async () => {
    const summary = await getJobSummary();
    console.table(summary);
  });


// For listing jobs

program
  .command('list')
  .option('--state <state>', 'Filter by job state')
  .description('List jobs by state')
  .action(async (opts) => {
    const jobs = await getJobsByState(opts.state);
    if (jobs.length === 0) {
      console.log(`No jobs found${opts.state ? ` with state "${opts.state}"` : ''}.`);
    } else {
      console.table(jobs.map(j => ({
        id: j.id,
        state: j.state,
        attempts: j.attempts,
        command: j.command,
        updated_at: j.updated_at
      })));
    }
  });


// For dlq

const dlq = program.command('dlq').description('Dead Letter Queue operations');

dlq
  .command('list')
  .description('List all jobs in the DLQ')
  .action(async () => {
    const jobs = await getJobsByState('dead');
    if (jobs.length === 0) {
      console.log('✅ DLQ is empty');
    } else {
      console.table(jobs.map(j => ({
        id: j.id,
        command: j.command,
        attempts: j.attempts,
        updated_at: j.updated_at
      })));
    }
  });

dlq
  .command('retry <jobid>')
  .description('Retry a job from the DLQ')
  .action(async (jobid) => {
    await moveJobToPending(jobid);
    console.log(`♻️  Moved job ${jobid} back to pending`);
  });


// For config

const config = program.command('config').description('Manage configuration');

config
  .command('set <key> <value>')
  .description('Set configuration key/value')
  .action(async (key, value) => {
    await setConfig(key, value);
    console.log(`✅ Config updated: ${key} = ${value}`);
  });

config
  .command('get [key]')
  .description('Get configuration value(s)')
  .action(async (key) => {
    const conf = await getConfig(key);
    console.log(conf);
  });


program.parseAsync(process.argv);
