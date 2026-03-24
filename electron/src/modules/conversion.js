export function setupConversionActions({
  inputEl,
  outputEl,
  logEl,
  pickInputBtn,
  pickOutputBtn,
  startBtn
}) {
  function appendLog(line) {
    logEl.value += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setRunning(running) {
    startBtn.disabled = running;
    pickInputBtn.disabled = running;
    pickOutputBtn.disabled = running;
    startBtn.textContent = running ? "转换中..." : "开始转换";
  }

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

    if (!inputDir || !outputDir) {
      appendLog("请先选择输入目录和输出目录。");
      return;
    }

    setRunning(true);
    appendLog("开始执行转换任务...");

    try {
      const result = await window.electronAPI.runConversion(inputDir, outputDir);
      appendLog(result);
    } catch (error) {
      appendLog(`执行失败: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  });
}
