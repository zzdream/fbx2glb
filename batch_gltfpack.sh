#!/bin/bash

INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"
# 可由环境变量 FBX2GLB_GLTFPACK_SI 覆盖，默认 1（不减面）
SI="${FBX2GLB_GLTFPACK_SI:-1}"

if [ -z "$INPUT_FOLDER" ] || [ -z "$OUTPUT_FOLDER" ]; then
    echo "Usage: ./batch_gltfpack.sh /path/to/glb /path/to/output"
    echo "支持递归子目录，保留目录结构"
    echo "参数: -cc mesh压缩 -tc 贴图压缩 -si <值> -kn -km 保留车灯网格"
    echo "可通过环境变量 FBX2GLB_GLTFPACK_SI 设置 -si（当前: $SI）"
    exit 1
fi

if [ ! -d "$INPUT_FOLDER" ]; then
    echo "Error: 输入目录不存在: $INPUT_FOLDER"
    exit 1
fi

# 检查 gltfpack 是否可用
if ! command -v gltfpack &>/dev/null; then
    echo "Error: 未找到 gltfpack，请先安装 meshoptimizer"
    exit 1
fi

# 简单校验 SI：非空且能当作数字用；非法则回退 1
if ! awk -v s="$SI" 'BEGIN { exit !(s+0 > 0 && s+0 <= 1) }'; then
    echo "Warning: FBX2GLB_GLTFPACK_SI='$SI' 非法，回退为 1"
    SI=1
fi

INPUT_FOLDER=$(cd "$INPUT_FOLDER" && pwd)
mkdir -p "$OUTPUT_FOLDER"
OUTPUT_FOLDER=$(cd "$OUTPUT_FOLDER" && pwd)

echo "gltfpack 参数: -cc -tc -si $SI -kn -km"

count=0
failed=0

# 递归查找所有 .glb 文件（排除 __MACOSX 和 ._ 开头的 Mac 元数据）
while IFS= read -r -d '' f; do
    rel_path="${f#$INPUT_FOLDER/}"
    rel_dir=$(dirname "$rel_path")
    filename=$(basename "$f")
    filename="${filename%.*}"
    out_dir="$OUTPUT_FOLDER/$rel_dir"
    out_file="$out_dir/$filename.glb"

    mkdir -p "$out_dir"
    echo "Compressing: $rel_path -> $rel_dir/$filename.glb"
    # 捕获 gltfpack 输出，失败时打印，方便排查
     if gltf_out="$(gltfpack -i "$f" -o "$out_file" -cc -tc -si "$SI" -kn -km 2>&1)"; then
        ((count++))
    else
        ((failed++))
        echo "  ^^ 失败"
        echo "$gltf_out"
    fi
done < <(find "$INPUT_FOLDER" -type f \( -iname "*.glb" \) -not -path "*/__MACOSX/*" -not -name "._*" -print0)

echo ""
echo "完成: 成功 $count 个, 失败 $failed 个"
# 示例: ./batch_gltfpack.sh /path/to/models /path/to/models_compressed
# 示例: FBX2GLB_GLTFPACK_SI=0.5 ./batch_gltfpack.sh /path/to/models /path/to/models_compressed
