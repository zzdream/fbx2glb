# FBX -> GLB 转换器（Electron 桌面版）

这是 `tauri/`（Tauri 版）的 Electron 对应实现，界面与核心功能保持一致：

- 选择输入目录（FBX）
- 选择输出目录（GLB）
- 一键执行仓库根目录的 `batch_fbx2glb_final.sh`（Windows 打包版使用 `batch_fbx2glb_final.bat`）
- 支持两种处理模式：
  - `FBX -> GLB -> 压缩`（默认）
  - `GLB -> 压缩`（直接压缩 GLB 文件夹）
- 支持选择本地 `.glb` 文件并在界面中预览模型（可旋转/缩放）
- 在界面中展示转换日志

## 环境要求

- Node.js 20+
- pnpm（或 npm）
- `fbx2gltf`、`gltfpack` 已可在终端里直接运行（开发模式下）

## 开发运行

```bash
cd electron
pnpm install
pnpm dev
```

默认会启动：

- Vite 开发服务：`http://localhost:1421`
- Electron 桌面窗口

## 常见问题

- 打包后运行报错 `未找到 fbx2gltf` 或 `未找到 gltfpack`：
  - 说明对应平台的 `bin-*` 目录里缺少 `fbx2gltf` / `gltfpack`（macOS 用 `bin-darwin-*`，Linux 用 `bin-linux-x64`，Windows 用 `bin-win-x64`）。
  - 见下方「准备可执行文件」后重新打包。
- Linux 上报错 `GLIBC_2.34 not found` 或 `GLIBCXX_3.4.30 not found`：
  - 官方 gltfpack 预编译包需要较新的 glibc（约 Ubuntu 22.04+）。请在**目标 Linux 系统上**从 [meshoptimizer](https://github.com/zeux/meshoptimizer) 源码编译 gltfpack，替换 `bin-linux-x64/gltfpack` 后重新打包。
- 报错 `Electron failed to install correctly`：
  - 说明 Electron 二进制没下载完整，可执行：
  - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/.pnpm/electron@36.9.5/node_modules/electron/install.js`
- 报错 `app is undefined` 或 Electron 像 Node 一样运行：
  - 通常是环境变量 `ELECTRON_RUN_AS_NODE=1` 导致。
  - 当前 `package.json` 的脚本已内置 `env -u ELECTRON_RUN_AS_NODE`，如你手动启动 Electron，也要先清掉该变量。
- 报错 `dmg-builder ... 404`（例如 `cdn.npmmirror.com/binaries/electron/...`）：
  - 这是镜像地址缺失资源导致，`build:mac` 脚本已内置下载源覆盖到 GitHub release。

## 打包安装包

### 1. 准备 fbx2gltf 和 gltfpack（按平台分目录）

**不要用 macOS 的二进制去打 Linux 包**，每种系统只认自己的 ELF / Mach-O。

#### macOS（打 `pnpm build:mac` 时用）

| 目录 | 适用 |
|------|------|
| `electron/bin-darwin-arm64/` | Apple Silicon (M1/M2/M3) |
| `electron/bin-darwin-x64/`   | Intel Mac |

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-darwin-x64`，重命名为 `fbx2gltf`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → macOS 包中的 `gltfpack`

#### Linux（仅 x86_64 / amd64；打 `pnpm build:linux` 时在 Linux 或 CI 上构建）

将工具放入 **`electron/bin-linux-x64/`**：

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-linux-x64`，重命名为 `fbx2gltf`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → Linux 包中的 `gltfpack`  
  **注意**：官方预编译 gltfpack 需要 glibc 2.34+（约 Ubuntu 22.04 及以上）。若在更老系统（如 Ubuntu 18.04）上出现 `GLIBC_2.34 not found` 等报错，请在**目标 Linux 上**从 meshoptimizer 源码编译 gltfpack 后放入该目录。


#### Windows（x64；打 `pnpm build:win` 时用）

将工具放入 **`electron/bin-win-x64/`**：

- **fbx2gltf**：https://github.com/facebookincubator/FBX2glTF/releases → `FBX2glTF-windows-x64.exe`，重命名为 `fbx2gltf.exe`
- **gltfpack**：https://github.com/zeux/meshoptimizer/releases → Windows 包中的 `gltfpack.exe`

```bash
# macOS 示例
chmod +x electron/bin-darwin-arm64/fbx2gltf electron/bin-darwin-arm64/gltfpack
chmod +x electron/bin-darwin-x64/fbx2gltf electron/bin-darwin-x64/gltfpack

# Linux 示例（在 Linux 上）
chmod +x electron/bin-linux-x64/fbx2gltf electron/bin-linux-x64/gltfpack
```

### 2. 执行打包

```bash
cd electron
pnpm install
pnpm build:mac          # macOS dmg（arm64 + x64）
pnpm build:linux        # Linux AppImage（x64），脚本内已包含 build:electron
pnpm build:win          # Windows NSIS（x64）
```

产物输出在 `electron/build/` 目录。

补充说明：

- **Windows**：已支持内置 `fbx2gltf.exe` + `gltfpack.exe` 转换链（x64）。
- 若只想构建前端静态资源，可执行 `pnpm build:electron`
