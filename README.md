queuectl — Background Job Queue System

A simple CLI-based background job queue built in Node.js with SQLite persistence and multi-worker support.

**Setup Instructions**

Prerequisites
- Node.js (v18 or above)
- npm (installed with Node)

Steps to Run Locally
cd queuectl

Install dependencies
    npm install

Enqueue a test job
    node src/cli.js enqueue --command "echo Hello Queue!"

Start workers to process jobs
    node src/cli.js worker start --count 2

**Usage Examples**
input:node src/cli.js enqueue --command "echo Hello Guru!"
output:Job enqueued: <id>

input:node src/cli.js worker start --count 2
output:2 workers started. Processing jobs

input:node src/cli.js status
output:Table with details (pending: 0, completed: 3)

input:node src/cli.js dlq list
output:Table with full detail(job-005 failed after 3 retries)

input:node src/cli.js list --state completed
output:Shows details of completed IDS

input:node src/cli.js worker stop
output:Workers stops


**Architecture**
The system is made up of a few simple components that work together:

    cli.js — Main command-line entry point. Parses commands like enqueue and worker start.
    db.js — Sets up the SQLite database and tables for storing job and configuration data.
    worker.js — Manages background workers that pick up jobs and run their commands.
    runner.js — Executes each job’s shell command and updates its status in the database.
    config.js — Stores and retrieves configuration values such as retry limits and backoff intervals.
    util.js — Provides helper functions for generating IDs and timestamps.

**Life Cycle**
pending → processing → completed / failed → (DLQ if retries exceeded)

**Persistence**
All job information is stored in db/queue.db, so jobs remain saved even after restarting the program.
Can be checked using node check.db command (gives all details about the procesess)

**Worker Logic**

Workers continuously check for jobs marked as "pending".
When they find one:

    They mark it as "processing".
    Run the associated shell command.
    If successful → mark as "completed".
    If failed → retry up to the configured maximum.
    If all retries fail → move to DLQ (Dead Letter Queue).

**Assumption and tradeoff**
Database	   -    Used SQLite	
Concurrency	   -   Multiple worker support	
Retry policy   -   Exponential backoff	
DLQ (Dead Letter Queue)	- Manual retry mechanism

**Testing Instructions**
Successfull Job
node src/cli.js enqueue --command "echo Test Job"
node src/cli.js worker start --count 1
Expected Result: Worker 1 completed the job

Failed Job with Retries
node src/cli.js enqueue --command "invalid_command"
node src/cli.js worker start --count 1
Expected Result: The job retries three times, then moves to the DLQ.

Retrying from DLQ
node src/cli.js dlq list
node src/cli.js dlq retry <job_id>
