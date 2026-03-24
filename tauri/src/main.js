import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const inputEl = document.querySelector("#inputDir");
const outputEl = document.querySelector("#outputDir");
const logEl = document.querySelector("#log");
const pickInputBtn = document.querySelector("#pickInputBtn");
const pickOutputBtn = document.querySelector("#pickOutputBtn");
const startBtn = document.querySelector("#startBtn");

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

  if (!inputDir || !outputDir) {
    appendLog("请先选择输入目录和输出目录。");
    return;
  }

  setRunning(true);
  appendLog("开始执行转换任务...");

  try {
    const result = await invoke("run_conversion", { inputDir, outputDir });
    appendLog(result);
  } catch (error) {
    appendLog(`执行失败: ${String(error)}`);
  } finally {
    setRunning(false);
  }
});
