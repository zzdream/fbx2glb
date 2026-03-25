#!/bin/bash

INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"

if [ -z "$INPUT_FOLDER" ] || [ -z "$OUTPUT_FOLDER" ]; then
    echo "Usage: ./batch_gltf_pipeline_draco.sh /path/to/glb /path/to/output"
    echo "递归处理所有 .glb，保留目录结构（等价于逐文件: gltf-pipeline -i in.glb -o out.glb -d）"
    exit 1
fi

if [ ! -d "$INPUT_FOLDER" ]; then
    echo "Error: 输入目录不存在: $INPUT_FOLDER"
    exit 1
fi

if ! command -v gltf-pipeline &>/dev/null; then
    echo "Error: 未找到 gltf-pipeline，请先安装：npm i -g gltf-pipeline"
    exit 1
fi

INPUT_FOLDER=$(cd "$INPUT_FOLDER" && pwd)
mkdir -p "$OUTPUT_FOLDER"
OUTPUT_FOLDER=$(cd "$OUTPUT_FOLDER" && pwd)

count=0
failed=0

while IFS= read -r -d '' f; do
    rel_path="${f#$INPUT_FOLDER/}"
    rel_dir=$(dirname "$rel_path")
    filename=$(basename "$f")
    filename="${filename%.*}"
    out_dir="$OUTPUT_FOLDER/$rel_dir"
    out_file="$out_dir/$filename.glb"

    mkdir -p "$out_dir"
    echo "Draco: $rel_path -> $rel_dir/$filename.glb"
    if gp_out="$(gltf-pipeline -i "$f" -o "$out_file" -d 2>&1)"; then
        ((count++))
    else
        ((failed++))
        echo "  ^^ 失败"
        echo "$gp_out"
    fi
done < <(find "$INPUT_FOLDER" -type f \( -iname "*.glb" \) -not -path "*/__MACOSX/*" -not -name "._*" -print0)

echo ""
echo "完成: 成功 $count 个, 失败 $failed 个"

# 示例: ./batch_gltf_pipeline_draco.sh /path/to/models /path/to/models_draco
