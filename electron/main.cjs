const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const WINDOWS_BIN_DIR = "bin-win-x64";

const isDev = !app.isPackaged;
const appDir = __dirname;

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    webPreferences: {
      preload: path.join(appDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:1421");
  } else {
    win.loadFile(path.join(appDir, "dist/index.html"));
  }
}

function repoRootFromCurrentDir() {
  let dir = process.cwd();
  while (true) {
    const markerSh = path.join(dir, "batch_fbx2glb_final.sh");
    const markerBat = path.join(dir, "batch_fbx2glb_final.bat");
    if (fs.existsSync(markerSh) || fs.existsSync(markerBat)) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("无法定位仓库根目录：未找到 batch_fbx2glb_final.sh / batch_fbx2glb_final.bat");
    }
    dir = parent;
  }
}

/** 打包后按操作系统 + CPU 选择内置工具目录（与 electron/package.json extraResources 一致） */
function getBundledBinDir() {
  if (process.platform === "darwin") {
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    return path.join(process.resourcesPath, `bin-darwin-${arch}`);
  }
  if (process.platform === "linux") {
    if (process.arch !== "x64") {
      return null;
    }
    return path.join(process.resourcesPath, "bin-linux-x64");
  }
  if (process.platform === "win32") {
    if (process.arch !== "x64") {
      return null;
    }
    return path.join(process.resourcesPath, WINDOWS_BIN_DIR);
  }
  return null;
}

function resolveScriptPath(mode) {
  const scriptName =
    process.platform === "win32"
      ? mode === "glb_compress_only"
        ? "batch_gltfpack.bat"
        : "batch_fbx2glb_final.bat"
      : mode === "glb_compress_only"
        ? "batch_gltfpack.sh"
        : "batch_fbx2glb_final.sh";
  const resourceCandidates = [
    path.join(process.resourcesPath, scriptName),
    path.join(process.resourcesPath, "resources", scriptName)
  ];

  for (const candidate of resourceCandidates) {
    if (fs.existsSync(candidate)) {
      return { scriptPath: candidate, useBundledResources: true };
    }
  }

  const repoRoot = repoRootFromCurrentDir();
  return {
    scriptPath: path.join(repoRoot, scriptName),
    useBundledResources: false
  };
}

function runConversionScript(inputDir, outputDir, mode) {
  const { scriptPath, useBundledResources } = resolveScriptPath(mode);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`未找到脚本: ${scriptPath}`);
  }

  const envVars = { ...process.env };
  if (useBundledResources) {
    const binDir = getBundledBinDir();
    if (!binDir) {
      if (process.platform === "linux" && process.arch !== "x64") {
        throw new Error(
          "当前打包版仅支持 Linux x86_64 (amd64)。请在 x64 Linux 上运行，或使用开发模式并自行安装 fbx2gltf / gltfpack。"
        );
      }
      if (process.platform === "win32" && process.arch !== "x64") {
        throw new Error(
          "当前打包版仅支持 Windows x86_64。请在 x64 Windows 上运行。"
        );
      }
      throw new Error(
        "当前平台不支持内置转换工具目录（支持 macOS / Linux x64 / Windows x64 打包版）。"
      );
    }
    const executableExt = process.platform === "win32" ? ".exe" : "";
    const fbx2gltf = path.join(binDir, `fbx2gltf${executableExt}`);
    const gltfpack = path.join(binDir, `gltfpack${executableExt}`);

    const binHint =
      process.platform === "darwin"
        ? `electron/bin-darwin-${process.arch === "arm64" ? "arm64" : "x64"}/`
        : process.platform === "linux"
          ? "electron/bin-linux-x64/"
          : `electron/${WINDOWS_BIN_DIR}/`;
    if (!fs.existsSync(fbx2gltf)) {
      throw new Error(
        `未找到 fbx2gltf：期望存在于 ${fbx2gltf}。请将 FBX2glTF 可执行文件放入 ${binHint} 后重新打包。`
      );
    }

    if (!fs.existsSync(gltfpack)) {
      throw new Error(
        `未找到 gltfpack：期望存在于 ${gltfpack}。请将 meshoptimizer 的 gltfpack 放入同上目录后重新打包。`
      );
    }

    const pathSep = process.platform === "win32" ? ";" : ":";
    envVars.PATH = `${binDir}${pathSep}${envVars.PATH || ""}`;
  }

  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/c", scriptPath, inputDir, outputDir], {
            cwd: path.dirname(scriptPath),
            env: envVars
          })
        : spawn("bash", [scriptPath, inputDir, outputDir], {
            cwd: path.dirname(scriptPath),
            env: envVars
          });

    let merged = "";

    child.stdout.on("data", (chunk) => {
      merged += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      merged += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`执行脚本失败: ${err.message}`));
    });

    child.on("close", (code) => {
      const output = merged.trim();
      if (code === 0) {
        resolve(output || "转换完成。");
      } else {
        reject(new Error(output || "脚本执行失败（无日志输出）"));
      }
    });
  });
}

ipcMain.handle("pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }

  return result.filePaths[0];
});

ipcMain.handle("run-conversion", async (_event, payload) => {
  const inputDir = (payload?.inputDir || "").trim();
  const outputDir = (payload?.outputDir || "").trim();
  const mode = payload?.mode === "glb_compress_only" ? "glb_compress_only" : "fbx_to_glb_compress";

  if (!inputDir || !outputDir) {
    throw new Error("输入和输出目录不能为空");
  }

  return runConversionScript(inputDir, outputDir, mode);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
