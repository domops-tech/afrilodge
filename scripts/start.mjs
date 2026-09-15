import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: process.env.APP_HOSTNAME || "0.0.0.0" },
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
server.on("exit", code => process.exit(code ?? 1));
