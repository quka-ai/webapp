#!/bin/bash
set -euo pipefail

echo "🚀 开始构建 QukaAI 桌面应用..."

remove_build_path() {
    local path="$1"
    if [ ! -e "$path" ]; then
        return
    fi

    chmod -R u+rwX "$path" 2>/dev/null || true
    find "$path" -name ".DS_Store" -delete 2>/dev/null || true
    rm -rf "$path"
    if [ -e "$path" ]; then
        chmod -R u+rwX "$path" 2>/dev/null || true
        find "$path" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
        rmdir "$path" 2>/dev/null || true
    fi
    if [ -e "$path" ]; then
        echo "❌ 无法清理构建目录: $path"
        exit 1
    fi
}

# 解析命令行参数
ARCH="arm64"  # 默认 Apple Silicon
PLATFORM="darwin/arm64"

while [[ $# -gt 0 ]]; do
    case $1 in
        --arch)
            ARCH="$2"
            if [ "$ARCH" = "amd64" ] || [ "$ARCH" = "x86_64" ]; then
                PLATFORM="darwin/amd64"
            elif [ "$ARCH" = "arm64" ]; then
                PLATFORM="darwin/arm64"
            elif [ "$ARCH" = "universal" ]; then
                PLATFORM="darwin/universal"
            else
                echo "❌ 不支持的架构: $ARCH"
                echo "支持的架构: arm64, amd64/x86_64, universal"
                exit 1
            fi
            shift 2
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--arch arm64|amd64|x86_64|universal]"
            exit 1
            ;;
    esac
done

echo "🎯 目标平台: $PLATFORM"

# 清理 Hermes runtime 临时源码，避免 Vite 扫描到上游 website/tsconfig.json。
if [ "${HERMES_RUNTIME_KEEP_BUILD_DIR:-0}" != "1" ] && [ -d build/hermes-runtime-build ]; then
    remove_build_path build/hermes-runtime-build
fi

# 0. 构建前端项目
npm run build-beta

# 1. 复制前端资源
echo "📦 复制前端资源..."
./copy-assets.sh

# 2. 构建应用
echo "🔨 构建应用..."
export PATH="$HOME/go/bin:$PATH"
./prepare-hermes-build.sh "build/bin/QukaAI.app"
remove_build_path build/bin
# build/bin has already been cleaned above; avoid Wails cleaning the same path again.
wails build -platform "$PLATFORM"

# 3. 检查构建是否成功
if [ $? -eq 0 ]; then
    echo "✅ 构建成功！"

    # 4. 打包 Hermes Agent runtime
    echo "🤖 打包 Hermes Agent runtime..."
    chmod +x bundle-hermes.sh 2>/dev/null
    ./bundle-hermes.sh "build/bin/QukaAI.app"

    # 5. 更新应用图标
    echo "🎨 更新应用图标..."

    # 确保图标文件存在
    if [ -f "icon.icns" ]; then
        cp icon.icns build/bin/QukaAI.app/Contents/Resources/iconfile.icns
        echo "✅ 图标已更新！"
    else
        echo "⚠️  警告：找不到 icon.icns 文件"
    fi

    echo ""
    echo "🎉 完成！应用位于：build/bin/QukaAI.app"
    echo ""
    echo "💡 提示："
    echo "   - 双击 build/bin/QukaAI.app 启动应用"
    echo "   - 或运行：open build/bin/QukaAI.app"
    echo ""
    echo "📊 构建信息："
    echo "   - 平台: $PLATFORM"
    if [ -f "build/bin/QukaAI.app/Contents/MacOS/QukaAI" ]; then
        echo "   - 架构: $(file build/bin/QukaAI.app/Contents/MacOS/QukaAI | cut -d: -f2)"
    fi
else
    echo "❌ 构建失败！"
    exit 1
fi
