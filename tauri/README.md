# FBX -> GLB 转换器（桌面应用）

基于 [Tauri](https://tauri.app/) 的桌面 GUI，提供图形界面完成 FBX 批量转 GLB 及 gltfpack 压缩。

功能与仓库根目录的 `batch_fbx2glb_final.sh` 脚本一致，详见 [项目主 README](../README.md)。

## 环境要求

- Node.js 20+
- pnpm（或 npm）
- Rust（Tauri 需要）
- **转换依赖**：`fbx2gltf`、`gltfpack`（与主脚本相同，见主 README 的「3 分钟快速开始」）

## 开发运行

在仓库根目录进入本目录（与 `package.json` 同级）：

```bash
cd tauri
pnpm install
pnpm tauri dev
```

## 打包构建

```bash
cd tauri
pnpm install
pnpm tauri build
```

平台相关构建脚本：

```bash
pnpm tauri:build:mac   # macOS（universal）
pnpm tauri:build:linux # Linux x64
pnpm tauri:build:win   # Windows x64（NSIS）
```

## 打包时嵌入依赖（给开发者）

构建前将对应平台的可执行文件放入 `tauri/src-tauri/resources/bin/`：

| 文件名 | 说明 |
|--------|------|
| `fbx2gltf` | 与主 README 中一致的官方二进制（macOS / Linux 无扩展名） |
| `gltfpack` | meshoptimizer 的 gltfpack 可执行文件 |

`tauri.conf.json` 的 `bundle.resources` 会把上述两个文件打进安装包，运行时由 `main.rs` 注入到 `PATH` 供脚本调用。

## 平台支持

- **macOS**：已支持（需自备上述二进制后打包）
- **Linux**：已支持（需自备上述二进制后打包）
- **Windows**：应用内转换仍为预留说明；请使用 macOS / Linux 包，或在 WSL 中运行根目录脚本

---

更多关于转换流程、压缩参数、常见问题等，请参考 [../README.md](../README.md)。
