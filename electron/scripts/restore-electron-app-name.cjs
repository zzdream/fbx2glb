/**
 * 打包前把 FBX2GLB.app 还原为 Electron.app，避免 electron-builder 找不到发行包。
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

if (process.platform !== "darwin") {
  process.exit(0);
}

const electronRoot = path.dirname(require.resolve("electron/package.json"));
const distDir = path.join(electronRoot, "dist");
const pathFile = path.join(electronRoot, "path.txt");
const srcApp = path.join(distDir, "FBX2GLB.app");
const dstApp = path.join(distDir, "Electron.app");

function setPlist(plistPath, key, value) {
  if (!fs.existsSync(plistPath)) return;
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath], {
      stdio: "ignore"
    });
  } catch {
    // ignore
  }
}

if (fs.existsSync(srcApp) && !fs.existsSync(dstApp)) {
  fs.renameSync(srcApp, dstApp);
}

if (fs.existsSync(dstApp)) {
  fs.writeFileSync(pathFile, "Electron.app/Contents/MacOS/Electron");
  const plist = path.join(dstApp, "Contents", "Info.plist");
  setPlist(plist, "CFBundleName", "Electron");
  setPlist(plist, "CFBundleDisplayName", "Electron");
  console.log("[restore-electron-app-name] 已还原为 Electron.app");
}
