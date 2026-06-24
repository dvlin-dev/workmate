#!/usr/bin/env bash
# 从 build/icon.png(1024×1024) 生成 build/icon.icns —— 仅用 macOS 自带 sips/iconutil，无额外依赖。
#
# 重新生成母版图标（蓝 W，Electron 离屏渲染）：
#   ./node_modules/.bin/electron scripts/render-icon.cjs build/icon.png
# 然后跑本脚本：
#   bash scripts/make-icns.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SET="build/icon.iconset"
rm -rf "$SET" && mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" build/icon.png --out "$SET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" build/icon.png --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o build/icon.icns
rm -rf "$SET"
echo "build/icon.icns ✓"
