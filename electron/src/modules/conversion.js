/**
 * 转换面板：绑定目录选择、模式切换与「开始转换」流程，通过 preload 暴露的 electronAPI 调用主进程。
 */
export function setupConversionActions({
  inputEl,
  outputEl,
  modeInputs,
  siInputEl,
  optionsCardEl,
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

  /** 读取页面上的 -si，非法时回退为 1 */
  function getSiValue() {
    const raw = Number.parseFloat(siInputEl?.value ?? "1");
    if (!Number.isFinite(raw) || raw <= 0 || raw > 1) {
      return 1;
    }
    return Math.round(raw * 100) / 100;
  }

  /** 根据模式更新输入目录标签，并隐藏/显示 gltfpack 参数区 */
  function updateInputLabelByMode() {
    const selectedMode = getSelectedMode();
    const inputLabelEl = document.querySelector('label[for="inputDir"]');
    if (inputLabelEl) {
      if (selectedMode === "glb_compress_only" || selectedMode === "glb_draco_only") {
        inputLabelEl.textContent = "输入目录（GLB）";
        inputEl.placeholder = "请选择输入目录";
      } else if (
        selectedMode === "fbx_to_glb_compress" ||
        selectedMode === "fbx_to_glb_compress_lit"
      ) {
        inputLabelEl.textContent = "输入目录（FBX）";
        inputEl.placeholder = "请选择输入目录";
      } else {
        inputLabelEl.textContent = "输入目录（FBX）";
        inputEl.placeholder = "请选择输入目录";
      }
    }

    if (optionsCardEl) {
      // Draco 模式不用 -si
      optionsCardEl.style.display = selectedMode === "glb_draco_only" ? "none" : "";
    }
  }

  /** 运行中禁用目录按钮并更新按钮文案，防止重复触发 */
  function setRunning(running) {
    startBtn.disabled = running;
    pickInputBtn.disabled = running;
    pickOutputBtn.disabled = running;
    if (siInputEl) {
      siInputEl.disabled = running;
    }
    startBtn.textContent = running ? "转换中..." : "开始转换";
  }

  for (const modeInput of modeInputs) {
    modeInput.addEventListener("change", updateInputLabelByMode);
  }
  updateInputLabelByMode();

  pickInputBtn.addEventListener("click", async () => {
    const selected = await window.electronAPI.pickDirectory();
    if (selected) {
      inputEl.value = selected;
    }
  });

  pickOutputBtn.addEventListener("click", async () => {
    const selected = await window.electronAPI.pickDirectory();
    if (selected) {
      outputEl.value = selected;
    }
  });

  startBtn.addEventListener("click", async () => {
    const inputDir = inputEl.value.trim();
    const outputDir = outputEl.value.trim();
    const selectedMode = getSelectedMode();
    const si = getSiValue();

    if (!inputDir || !outputDir) {
      appendLog("请先选择输入目录和输出目录。");
      return;
    }

    if (siInputEl && selectedMode !== "glb_draco_only") {
      const typed = Number.parseFloat(siInputEl.value);
      if (!Number.isFinite(typed) || typed <= 0 || typed > 1) {
        appendLog("压缩强度（-si）需为 0.01～1 之间的数字，已忽略本次提交。");
        return;
      }
      siInputEl.value = String(si);
    }

    setRunning(true);
    if (selectedMode === "glb_compress_only") {
      appendLog(`开始执行压缩任务（GLB -> 压缩 GLB，gltfpack -si ${si}）...`);
    } else if (selectedMode === "glb_draco_only") {
      appendLog("开始执行压缩任务（GLB -> Draco 压缩 GLB）...");
    } else if (selectedMode === "fbx_to_glb_compress_lit") {
      appendLog(`开始执行转换任务（FBX -> GLB -> 压缩 -si ${si}，场景受光）...`);
    } else {
      appendLog(`开始执行转换任务（FBX -> GLB -> 压缩 -si ${si}，标志牌优化）...`);
    }

    try {
      const result = await window.electronAPI.runConversion(inputDir, outputDir, selectedMode, {
        si
      });
      appendLog(result);
    } catch (error) {
      appendLog(`执行失败: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  });
}
