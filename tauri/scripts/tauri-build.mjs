import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const targetIdx = args.indexOf("--target");
const target = targetIdx >= 0 ? args[targetIdx + 1] : null;

if (!target) {
  console.error("[fbx2glb][tauri-build] missing --target <triple>");
  process.exit(2);
}

const appRoot = path.resolve(import.meta.dirname, "..");
const bundleDir = path.join(appRoot, "src-tauri", "target", "release", "bundle");

if (clean && fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
  console.log(`[fbx2glb][tauri-build] cleaned: ${bundleDir}`);
}

// Tauri 的 `--ci` 会读取 env: CI=1，并且某些场景下会把 "1" 解析成无效值。
const env = {
  ...process.env,
  CI: "false",
  RUST_BACKTRACE: process.env.RUST_BACKTRACE || "1",
};

// Windows 上直接 spawn `node_modules/.bin/tauri.cmd` 在部分 CI 环境下会失败或吞日志；
// 用 node 执行 CLI 入口更稳。
const cliMain = path.join(appRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
if (!fs.existsSync(cliMain)) {
  console.error(`[fbx2glb][tauri-build] @tauri-apps/cli not found: ${cliMain}`);
  process.exit(2);
}

const buildArgs = ["build", "--target", target, "--no-sign", "-v"];

console.log(
  `[fbx2glb][tauri-build] ${process.execPath} ${cliMain} ${buildArgs.join(" ")}`
);

const result = spawnSync(process.execPath, [cliMain, ...buildArgs], {
  cwd: appRoot,
  env,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  console.error("[fbx2glb][tauri-build] spawn error:", result.error);
}

if (result.status !== 0 && result.status !== null) {
  console.error(`[fbx2glb][tauri-build] failed with exit code: ${result.status}`);
}

if (result.signal) {
  console.error(`[fbx2glb][tauri-build] killed by signal: ${result.signal}`);
}

const exitCode =
  typeof result.status === "number"
    ? result.status
    : result.error
      ? 1
      : 0;
process.exit(exitCode);
