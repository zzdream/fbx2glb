import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export function setupConversionActions({
  inputEl,
  outputEl,
  modeInputs,
  logEl,
  pickInputBtn,
  pickOutputBtn,
  startBtn
}) {
  function appendLog(line) {
    logEl.value += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function getSelectedMode() {
    return Array.from(modeInputs).find((el) => el.checked)?.value || "fbx_to_glb_compress";
  }

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
