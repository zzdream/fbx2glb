/**
 * 开发态 macOS Dock 显示名来自 Electron.app 包名，app.setName 无效。
 * 将 Electron.app 重命名为 FBX2GLB.app，并同步 path.txt / Info.plist。
 * 仅 darwin；打包前需先跑 restore-electron-app-name.cjs。
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const APP_NAME = "FBX2GLB";

if (process.platform !== "darwin") {
  process.exit(0);
}

const electronRoot = path.dirname(require.resolve("electron/package.json"));
const distDir = path.join(electronRoot, "dist");
const pathFile = path.join(electronRoot, "path.txt");
const srcApp = path.join(distDir, "Electron.app");
const dstApp = path.join(distDir, `${APP_NAME}.app`);

function setPlist(plistPath, key, value) {
  if (!fs.existsSync(plistPath)) return;
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath], {
      stdio: "ignore"
    });
  } catch {
    try {
      execFileSync("/usr/libexec/PlistBuddy", ["-c", `Add :${key} string ${value}`, plistPath], {
        stdio: "ignore"
      });
    } catch {
      // ignore
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.warn("[set-electron-dev-name] electron dist 不存在，跳过");
  process.exit(0);
}

if (fs.existsSync(srcApp) && !fs.existsSync(dstApp)) {
  fs.renameSync(srcApp, dstApp);
} else if (!fs.existsSync(dstApp)) {
  console.warn("[set-electron-dev-name] 未找到 Electron.app / FBX2GLB.app，跳过");
  process.exit(0);
}

fs.writeFileSync(pathFile, `${APP_NAME}.app/Contents/MacOS/Electron`);

const plist = path.join(dstApp, "Contents", "Info.plist");
setPlist(plist, "CFBundleName", APP_NAME);
setPlist(plist, "CFBundleDisplayName", APP_NAME);

console.log(`[set-electron-dev-name] 开发态应用名已设为 ${APP_NAME}`);
