import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

const host = process.env.PREVIEW_SMOKE_HOST ?? "127.0.0.1";
const port = Number(process.env.PREVIEW_SMOKE_PORT ?? "4173");
const baseUrl = `http://${host}:${port}`;
const routes = ["/", "/app", "/app/projects/1/edit"];

if (!existsSync(distDir)) {
  console.error("Preview smoke requires a production build. Run `npm run build` first.");
  process.exit(1);
}

if (!existsSync(viteBin)) {
  console.error("Vite is not installed. Run `npm ci` before the preview smoke check.");
  process.exit(1);
}

const server = spawn(
  process.execPath,
  [viteBin, "preview", "--host", host, "--port", String(port), "--strictPort"],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  serverOutput += text;
  process.stdout.write(text);
});
server.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  serverOutput += text;
  process.stderr.write(text);
});

async function shutdown() {
  if (server.exitCode !== null || server.signalCode !== null) return;

  await new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
    }, 3000);
    server.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    server.kill("SIGTERM");
  });
}

async function waitForPreview() {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${server.exitCode}.\n${serverOutput}`);
    }

    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for Vite preview at ${baseUrl}: ${lastError?.message ?? "unknown error"}`);
}

async function assertSpaRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, { cache: "no-store" });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status !== 200) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  if (!contentType.includes("text/html")) {
    throw new Error(`${route} returned unexpected content type: ${contentType || "missing"}`);
  }
  if (!body.includes('<div id="root"></div>')) {
    throw new Error(`${route} did not return the ProjectOps SPA shell`);
  }
}

try {
  await waitForPreview();
  for (const route of routes) {
    await assertSpaRoute(route);
    console.log(`Preview smoke passed: ${route}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await shutdown();
}
