const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const os = require("os");

const WINDOWS_BIN_DIR = "bin-win-x64";

const isDev = !app.isPackaged;
const appDir = __dirname;

function resolveWindowsCmdExe() {
  const comspec = process.env.ComSpec || process.env.COMSPEC;
  if (comspec && fs.existsSync(comspec)) {
    return comspec;
  }

  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT || "C:\\Windows";
  const systemCmd = path.join(systemRoot, "System32", "cmd.exe");
  if (fs.existsSync(systemCmd)) {
    return systemCmd;
  }

  return "cmd.exe";
}

function stripEnclosingQuotes(value) {
  const s = (value ?? "").trim();
  if (s.length >= 2) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
  }
  return s;
}

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
        : mode === "glb_draco_only"
          ? "batch_gltf_pipeline_draco.bat"
          : "batch_fbx2glb_final.bat"
      : mode === "glb_compress_only"
        ? "batch_gltfpack.sh"
        : mode === "glb_draco_only"
          ? "batch_gltf_pipeline_draco.sh"
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

  const debugHeader = [
    // "==== FBX2GLB DEBUG ====",
    // `platform=${process.platform} arch=${process.arch}`,
    // `mode=${mode}`,
    // `useBundledResources=${String(useBundledResources)}`,
    // `executionStrategy=${
    //   process.platform === "win32" && useBundledResources ? "direct_exe" : "bat_script"
    // }`,
    // `scriptPath=${scriptPath}`,
    // `inputDir=${inputDir}`,
    // `outputDir=${outputDir}`,
    // `PATH_head=${(envVars.PATH || "").slice(0, 220)}`
  ].join("\n");

  // Windows 打包后的运行：不要再依赖 cmd/bat，直接跑 exe，彻底规避引号转义导致的乱码/解析失败。
  if (process.platform === "win32" && useBundledResources) {
    const binDir = getBundledBinDir();
    const fbx2gltfExe = path.join(binDir, "fbx2gltf.exe");
    const gltfpackExe = path.join(binDir, "gltfpack.exe");
    const gltfPipelineExe = path.join(binDir, "gltf-pipeline.exe");

    if (!fs.existsSync(fbx2gltfExe)) {
      throw new Error(`未找到 fbx2gltf：${fbx2gltfExe}`);
    }
    if (!fs.existsSync(gltfpackExe)) {
      throw new Error(`未找到 gltfpack：${gltfpackExe}`);
    }

    async function listFilesRecursive(rootDir, predicate) {
      /** @type {string[]} */
      const results = [];
      async function walk(dir) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
          const fullPath = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (ent.name === "__MACOSX") continue; // 对齐 bat 的跳过逻辑
            await walk(fullPath);
          } else if (ent.isFile()) {
            if (predicate(fullPath)) results.push(fullPath);
          }
        }
      }
      await walk(rootDir);
      return results;
    }

    function toRelativeOutFile(inputRoot, filePath, outputRoot) {
      const rel = path.relative(inputRoot, filePath);
      const relDir = path.dirname(rel);
      const { name } = path.parse(filePath);
      const outDir = relDir === "." ? outputRoot : path.join(outputRoot, relDir);
      const outFile = path.join(outDir, `${name}.glb`);
      return { rel, outDir, outFile };
    }

    function runExe(exePath, args) {
      return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        const child = spawn(exePath, args, {
          cwd: path.dirname(exePath),
          env: envVars,
          windowsHide: true
        });
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", (err) => {
          resolve({ code: -1, stdout, stderr: err.message });
        });
        child.on("close", (code) => {
          resolve({ code: code ?? 0, stdout, stderr });
        });
      });
    }

    async function convertFbxToGlbCompress() {
      const tempRoot = path.join(
        os.tmpdir(),
        `fbx2glb_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
      );

      let converted = 0;
      let failedConvert = 0;
      let compressed = 0;
      let failedCompress = 0;

      let merged = debugHeader + "\n";

      const fbxFiles = await listFilesRecursive(inputDir, (p) => {
        const lower = p.toLowerCase();
        if (!lower.endsWith(".fbx")) return false;
        const base = path.basename(p);
        if (base.startsWith("._")) return false;
        return true;
      });

      try {
        for (const fbxPath of fbxFiles) {
          const { rel, outDir: tmpOutDir, outFile: tmpOutFile } = toRelativeOutFile(
            inputDir,
            fbxPath,
            tempRoot
          );
          await fs.promises.mkdir(tmpOutDir, { recursive: true });

          merged += `Converting: ${rel} -> ${path.relative(tempRoot, tmpOutFile)}\n`;
          const { code, stdout, stderr } = await runExe(fbx2gltfExe, [
            "-i",
            fbxPath,
            "-o",
            tmpOutFile,
            "--khr-materials-unlit"
          ]);
          if (code !== 0) {
            failedConvert++;
            merged += `  ^^ 失败 (fbx2gltf exit code ${code})\n`;
            if (stdout) merged += `-- stdout --\n${stdout}\n`;
            if (stderr) merged += `-- stderr --\n${stderr}\n`;
            continue;
          }
          converted++;

          const finalOutDir = tmpOutDir === tempRoot ? outputDir : path.join(outputDir, path.relative(tempRoot, tmpOutDir));
          await fs.promises.mkdir(finalOutDir, { recursive: true });
          merged += `Compressing: ${rel} -> ${path.relative(outputDir, path.join(finalOutDir, path.basename(tmpOutFile)))}\n`;
          const { code: cCode, stdout: cStdout, stderr: cStderr } = await runExe(gltfpackExe, [
            "-i",
            tmpOutFile,
            "-o",
            path.join(finalOutDir, path.basename(tmpOutFile)),
            "-cc",
            "-tc",
            "-si",
            "0.5"
          ]);
          if (cCode !== 0) {
            failedCompress++;
            merged += `  ^^ 失败 (gltfpack exit code ${cCode})\n`;
            if (cStdout) merged += `-- stdout --\n${cStdout}\n`;
            if (cStderr) merged += `-- stderr --\n${cStderr}\n`;
          } else {
            compressed++;
          }
        }
      } finally {
        // 清理临时目录
        try {
          await fs.promises.rm(tempRoot, { recursive: true, force: true });
        } catch (e) {
          // ignore
        }
      }

      merged += `\n完成: 转换成功 ${converted} 个, 转换失败 ${failedConvert} 个\n`;
      merged += `完成: 压缩成功 ${compressed} 个, 压缩失败 ${failedCompress} 个\n`;
      return merged;
    }

    async function compressGlbOnly() {
      let merged = debugHeader + "\n";
      let compressed = 0;
      let failedCompress = 0;

      const glbFiles = await listFilesRecursive(inputDir, (p) => {
        const lower = p.toLowerCase();
        if (!(lower.endsWith(".glb"))) return false;
        const base = path.basename(p);
        if (base.startsWith("._")) return false;
        return true;
      });

      for (const glbPath of glbFiles) {
        const { rel, outDir, outFile } = toRelativeOutFile(inputDir, glbPath, outputDir);
        await fs.promises.mkdir(outDir, { recursive: true });

        merged += `Compressing: ${rel} -> ${path.relative(outputDir, outFile)}\n`;
        const { code, stdout, stderr } = await runExe(gltfpackExe, [
          "-i",
          glbPath,
          "-o",
          outFile,
          "-cc",
          "-tc",
          "-si",
          "0.5"
        ]);
        if (code !== 0) {
          failedCompress++;
          merged += `  ^^ 失败 (gltfpack exit code ${code})\n`;
          if (stdout) merged += `-- stdout --\n${stdout}\n`;
          if (stderr) merged += `-- stderr --\n${stderr}\n`;
        } else {
          compressed++;
        }
      }

      merged += `\n完成: 压缩成功 ${compressed} 个, 压缩失败 ${failedCompress} 个\n`;
      return merged;
    }

    if (mode === "glb_draco_only") {
      if (!fs.existsSync(gltfPipelineExe)) {
        throw new Error(`glb_draco_only 需要 gltf-pipeline，但未在打包资源中找到：${gltfPipelineExe}`);
      }
      // 目前先给出明确错误，避免继续走 bat/cmd 导致同类解析问题。
      throw new Error("glb_draco_only 未实现（需要在 Node 侧接 gltf-pipeline 参数逻辑）");
    }

    if (mode === "fbx_to_glb_compress") {
      return convertFbxToGlbCompress();
    }
    if (mode === "glb_compress_only") {
      return compressGlbOnly();
    }
  }

  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(resolveWindowsCmdExe(), ["/d", "/s", "/c", scriptPath, inputDir, outputDir], {
            cwd: path.dirname(scriptPath),
            env: envVars,
            windowsHide: true
          })
        : spawn("bash", [scriptPath, inputDir, outputDir], {
            cwd: path.dirname(scriptPath),
            env: envVars
          });

    let merged = debugHeader + "\n";

    child.stdout.on("data", (chunk) => {
      merged += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      merged += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`执行脚本失败: ${err.message}\n${debugHeader}`));
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
  const inputDir = stripEnclosingQuotes(payload?.inputDir || "");
  const outputDir = stripEnclosingQuotes(payload?.outputDir || "");
  const allowedModes = new Set(["fbx_to_glb_compress", "glb_compress_only", "glb_draco_only"]);
  const mode = allowedModes.has(payload?.mode) ? payload.mode : "fbx_to_glb_compress";

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
