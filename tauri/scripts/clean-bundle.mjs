import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const bundleDir = path.join(appRoot, "src-tauri", "target", "release", "bundle");

if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}

console.log(`[fbx2glb][clean] removed: ${bundleDir}`);

