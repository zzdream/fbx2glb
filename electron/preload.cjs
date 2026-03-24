const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  runConversion: (inputDir, outputDir) =>
    ipcRenderer.invoke("run-conversion", { inputDir, outputDir })
});
