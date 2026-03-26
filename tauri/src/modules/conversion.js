import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * 转换面板：绑定目录选择、模式切换与「开始转换」，通过 Tauri `invoke("run_conversion")` 调 Rust 侧。
 */
export function setupConversionActions({
  inputEl,
  outputEl,
  modeInputs,
  logEl,
  pickInputBtn,
  pickOutputBtn,
  startBtn
}) {
  /** 追加一行日志并滚动到底部 */
  function appendLog(line) {
    logEl.value += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  /** 当前选中的转换模式（默认 FBX→GLB 压缩流水线） */
  function getSelectedMode() {
    return Array.from(modeInputs).find((el) => el.checked)?.value || "fbx_to_glb_compress";
  }

  /** 根据模式更新输入目录标签与占位符；纯 GLB 模式提示包含 .glb */
  function updateInputLabelByMode() {
    const selectedMode = getSelectedMode();
    const inputLabelEl = document.querySelector('label[for="inputDir"]');
    if (!inputLabelEl) {
      return;
    }

    if (selectedMode === "glb_compress_only" || selectedMode === "glb_draco_only") {
      inputLabelEl.textContent = "输入目录（GLB）";
      inputEl.placeholder = "请选择输入目录（包含 .glb 文件）";
    } else {
      inputLabelEl.textContent = "输入目录（FBX）";
      inputEl.placeholder = "请选择输入目录";
    }
  }

  /** 运行中禁用目录按钮并更新按钮文案，防止重复触发 */
  function setRunning(running) {
    startBtn.disabled = running;
    pickInputBtn.disabled = running;
    pickOutputBtn.disabled = running;
    startBtn.textContent = running ? "转换中..." : "开始转换";
  }

  for (const modeInput of modeInputs) {
    modeInput.addEventListener("change", updateInputLabelByMode);
  }
  updateInputLabelByMode();

  pickInputBtn.addEventListener("click", async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string" && selected.length > 0) {
      inputEl.value = selected;
    }
  });

  pickOutputBtn.addEventListener("click", async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string" && selected.length > 0) {
      outputEl.value = selected;
    }
  });

  startBtn.addEventListener("click", async () => {
    const inputDir = inputEl.value.trim();
    const outputDir = outputEl.value.trim();
    const selectedMode = getSelectedMode();

    if (!inputDir || !outputDir) {
      appendLog("请先选择输入目录和输出目录。");
      return;
    }

    setRunning(true);
    if (selectedMode === "glb_compress_only") {
      appendLog("开始执行压缩任务（GLB -> 压缩 GLB，gltfpack）...");
    } else if (selectedMode === "glb_draco_only") {
      appendLog("开始执行压缩任务（GLB -> Draco 压缩 GLB）...");
    } else {
      appendLog("开始执行转换任务（FBX -> GLB -> 压缩）...");
    }

    try {
      const result = await invoke("run_conversion", { inputDir, outputDir, mode: selectedMode });
      appendLog(result);
    } catch (error) {
      appendLog(`执行失败: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  });
}
