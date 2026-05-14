const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const port = readPort(envPath);

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  console.log(`Checking port ${port}...`);
  const pids = await findListeningPids(port);
  const ownPid = String(process.pid);

  for (const pid of new Set(pids.filter(pid => pid && pid !== ownPid))) {
    console.log(`Stopping process ${pid} on port ${port}...`);
    await killPid(pid);
  }

  console.log("Starting portfolio chat server...");
  console.log(`Open http://localhost:${port}/`);
  console.log("Press Ctrl+C to stop the server.\n");

  const server = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  const stopServer = () => {
    if (!server.killed) {
      server.kill("SIGINT");
    }
  };

  process.on("SIGINT", stopServer);
  process.on("SIGTERM", stopServer);

  server.on("exit", code => {
    process.exit(code || 0);
  });
}

function readPort(filePath) {
  if (!fs.existsSync(filePath)) return 3000;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "PORT" && value) {
      return Number(value) || 3000;
    }
  }

  return 3000;
}

function findListeningPids(targetPort) {
  if (process.platform === "win32") {
    return execText("netstat", ["-ano"]).then(output => {
      const regex = new RegExp(`:${targetPort}\\s+.*LISTENING\\s+(\\d+)`, "i");
      return output
        .split(/\r?\n/)
        .map(line => line.match(regex)?.[1])
        .filter(Boolean);
    });
  }

  return execText("sh", ["-c", `lsof -ti tcp:${targetPort} -sTCP:LISTEN 2>/dev/null || true`])
    .then(output => output.split(/\s+/).filter(Boolean));
}

function killPid(pid) {
  if (process.platform === "win32") {
    return execText("taskkill", ["/PID", pid, "/F", "/T"]).catch(() => {});
  }

  return execText("kill", ["-TERM", pid]).catch(() => {});
}

function execText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}
