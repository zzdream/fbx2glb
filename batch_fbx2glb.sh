#!/bin/bash

INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"

if [ -z "$INPUT_FOLDER" ] || [ -z "$OUTPUT_FOLDER" ]; then
    echo "Usage: ./batch_fbx2glb.sh /path/to/fbx /path/to/glb"
    echo "支持递归子目录，保留目录结构"
    exit 1
fi

if [ ! -d "$INPUT_FOLDER" ]; then
    echo "Error: 输入目录不存在: $INPUT_FOLDER"
    exit 1
fi

# 检查 fbx2gltf 是否可用
if ! command -v fbx2gltf &>/dev/null; then
    echo "Error: 未找到 fbx2gltf，请先安装 FBX2glTF"
    exit 1
fi

INPUT_FOLDER=$(cd "$INPUT_FOLDER" && pwd)
mkdir -p "$OUTPUT_FOLDER"
OUTPUT_FOLDER=$(cd "$OUTPUT_FOLDER" && pwd)

count=0
failed=0

# 递归查找所有 .fbx 和 .FBX 文件（排除 __MACOSX 和 ._ 开头的 Mac 元数据）
while IFS= read -r -d '' f; do
    rel_path="${f#$INPUT_FOLDER/}"
    rel_dir=$(dirname "$rel_path")
    filename=$(basename "$f")
    filename="${filename%.*}"  # 去掉扩展名，兼容 .fbx / .FBX
    out_dir="$OUTPUT_FOLDER/$rel_dir"
    out_file="$out_dir/$filename.glb"

    mkdir -p "$out_dir"
    echo "Converting: $rel_path -> $rel_dir/$filename.glb"
    # 捕获 fbx2gltf 输出，失败时打印，方便非技术用户排查
    if fbx_out="$(fbx2gltf -i "$f" -o "$out_file" --khr-materials-unlit 2>&1)"; then
        ((count++))
    else
        ((failed++))
        echo "  ^^ 失败"
        echo "$fbx_out"
    fi
done < <(find "$INPUT_FOLDER" -type f \( -iname "*.fbx" \) -not -path "*/__MACOSX/*" -not -name "._*" -print0)

echo ""
echo "完成: 成功 $count 个, 失败 $failed 个"

# 示例: ./batch_fbx2glb.sh /path/to/models /path/to/models2
