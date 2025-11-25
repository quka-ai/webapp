#!/bin/bash

echo "🚀 开始构建 QukaAI 桌面应用..."

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

# 1. 复制前端资源
echo "📦 复制前端资源..."
./copy-assets.sh

# 2. 构建应用
echo "🔨 构建应用..."
export PATH="$HOME/go/bin:$PATH"
wails build -clean -platform "$PLATFORM"

# 3. 检查构建是否成功
if [ $? -eq 0 ]; then
    echo "✅ 构建成功！"

    # 4. 更新应用图标
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
