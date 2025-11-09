const { exec } = require('child_process');

/*
  Execute a shell command and resolve with {code, stdout, stderr}
  Timeout/captive-output not implemented beyond child's default.
 */
function runCommand(command, timeoutMs = 0) {
  return new Promise((resolve) => {
    const child = exec(command, { shell: '/bin/bash' }, (error, stdout, stderr) => {
      if (error) {
        const code = (error && error.code) ? error.code : 1;
        return resolve({ code, stdout: stdout || '', stderr: stderr || '' });
      }
      resolve({ code: 0, stdout: stdout || '', stderr: stderr || '' });
    });
    if (timeoutMs > 0) {
      setTimeout(() => {
        try { child.kill('SIGTERM'); } catch (e) {}
      }, timeoutMs);
    }
  });
}

module.exports = {
  runCommand
};
