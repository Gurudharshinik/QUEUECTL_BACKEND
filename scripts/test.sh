#!/usr/bin/env bash
set -e
node src/cli.js enqueue '{"id":"job-ok","command":"echo Hello OK; exit 0"}'
node src/cli.js enqueue '{"id":"job-fail","command":"bash -c \"echo fail; exit 2\"","max_retries":2}'
node src/cli.js status
echo "Starting 2 workers..."
node src/cli.js worker start --count 2
echo "Workers started - sleep 6s to allow processing"
sleep 6
node src/cli.js status
echo "Stopping workers"
node src/cli.js worker stop
echo "DLQ:"
node src/cli.js dlq list
