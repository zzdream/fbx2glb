#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(target_os = "windows"))]
use std::env;
#[cfg(not(target_os = "windows"))]
use std::path::PathBuf;
#[cfg(not(target_os = "windows"))]
use std::process::Command;

use tauri::Manager;

#[cfg(not(target_os = "windows"))]
fn repo_root_from_current_dir() -> Result<PathBuf, String> {
    let mut dir = env::current_dir().map_err(|e| format!("读取当前目录失败: {e}"))?;

    // 向上遍历目录，直到找到转换脚本作为"仓库根目录"标记。
    loop {
        let marker_fbx = dir.join("batch_fbx2glb_final.sh");
        let marker_glb = dir.join("batch_gltfpack.sh");
        if marker_fbx.exists() || marker_glb.exists() {
            return Ok(dir);
        }

        // 到达根目录后仍找不到，直接失败。
        if !dir.pop() {
            break;
        }
    }

    Err("无法定位仓库根目录：未找到 batch_fbx2glb_final.sh / batch_gltfpack.sh".to_string())
}

#[cfg(not(target_os = "windows"))]
fn run_unix_script(
    app: &tauri::AppHandle,
    input_dir: &str,
    output_dir: &str,
    mode: &str,
) -> Result<String, String> {
    // 生产环境：脚本随应用一起打包到 `src-tauri/resources`，macOS 在 `.app/Contents/Resources`。
    // 开发环境：回退到仓库根目录（通过找 `batch_fbx2glb_final.sh` 标记）。
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {e}"))?;

    let script_name = if mode == "glb_compress_only" {
        "batch_gltfpack.sh"
    } else {
        "batch_fbx2glb_final.sh"
    };

    let (script_path, use_bundled_resources) = {
        let candidate_direct = resource_dir.join(script_name);
        let candidate_nested = resource_dir.join(format!("resources/{script_name}"));
        if candidate_direct.exists() {
            (candidate_direct, true)
        } else if candidate_nested.exists() {
            (candidate_nested, true)
        } else {
            (repo_root_from_current_dir()?.join(script_name), false)
        }
    };

    if !script_path.exists() {
        return Err(format!("未找到脚本: {}", script_path.to_string_lossy()));
    }

    // 生产环境里如果我们把转换依赖打进了安装包，就需要把它们加入 PATH。
    if use_bundled_resources {
        let bin_dir = resource_dir.join("bin");
        let fbx2gltf = bin_dir.join("fbx2gltf");
        let gltfpack = bin_dir.join("gltfpack");

        if !fbx2gltf.exists() {
            return Err(format!(
                "未找到 fbx2gltf：期望存在于 {}。你需要把官方 fbx2gltf 可执行文件放入 app/src-tauri/resources/bin/fbx2gltf，然后重新 tauri build。",
                fbx2gltf.to_string_lossy()
            ));
        }
        if !gltfpack.exists() {
            return Err(format!(
                "未找到 gltfpack：期望存在于 {}。你需要把官方 gltfpack 可执行文件放入 app/src-tauri/resources/bin/gltfpack，然后重新 tauri build。",
                gltfpack.to_string_lossy()
            ));
        }

        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}:{}", bin_dir.to_string_lossy(), current_path);

        // 让后续脚本里的 `command -v fbx2gltf/gltfpack` 能在安装包内找到二进制。
        // （这里用环境变量注入到子进程）
        env::set_var("PATH", new_path);
    }

    let output = Command::new("bash")
        .arg(script_path.to_string_lossy().to_string())
        .arg(input_dir)
        .arg(output_dir)
        .current_dir(script_path.parent().unwrap_or_else(|| std::path::Path::new(".")))
        .output()
        .map_err(|e| format!("执行脚本失败: {e}"))?;

    let mut merged = String::new();
    merged.push_str(&String::from_utf8_lossy(&output.stdout));
    if !output.stderr.is_empty() {
        if !merged.ends_with('\n') {
            merged.push('\n');
        }
        merged.push_str(&String::from_utf8_lossy(&output.stderr));
    }

    if output.status.success() {
        Ok(merged)
    } else {
        Err(if merged.trim().is_empty() {
            "脚本执行失败（无日志输出）".to_string()
        } else {
            merged
        })
    }
}

#[tauri::command]
fn run_conversion(
    app: tauri::AppHandle,
    input_dir: String,
    output_dir: String,
    mode: Option<String>,
) -> Result<String, String> {
    if input_dir.trim().is_empty() || output_dir.trim().is_empty() {
        return Err("输入和输出目录不能为空".to_string());
    }
    let selected_mode = mode.unwrap_or_else(|| "fbx_to_glb_compress".to_string());

    #[cfg(target_os = "windows")]
    {
        let _ = app;
        let _ = selected_mode;
        Err(
            "当前 Windows 版本仍通过 bash 脚本流程预留；请使用 macOS / Linux 构建的安装包，或在 WSL 中运行仓库根目录的 batch_fbx2glb_final.sh。"
                .to_string(),
        )
    }

    #[cfg(not(target_os = "windows"))]
    {
        run_unix_script(&app, &input_dir, &output_dir, &selected_mode)
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run_conversion])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
