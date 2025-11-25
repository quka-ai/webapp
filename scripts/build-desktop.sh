#!/bin/bash

echo "🚀 开始构建 QukaAI 桌面应用..."
echo ""

# 1. 构建前端
echo "📦 步骤 1/3: 构建前端..."
npm run build-beta

if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败！"
    exit 1
fi

echo ""

# 2. 构建 Wails 应用
echo "🔨 步骤 2/3: 构建 Wails 应用..."
cd quka-desktop

# 确保有可执行权限
chmod +x build.sh 2>/dev/null
chmod +x copy-assets.sh 2>/dev/null

# 执行构建
./build.sh --arch universal

if [ $? -ne 0 ]; then
    echo "❌ Wails 应用构建失败！"
    exit 1
fi

echo ""

# 3. 提示用户如何启动应用
echo "📂 步骤 3/3: 准备启动应用..."

APP_NAME="QukaAI.app"
SOURCE_PATH="$(pwd)/build/bin/$APP_NAME"

# 检查源文件是否存在
if [ ! -d "$SOURCE_PATH" ]; then
    echo "❌ 构建产物未找到：$SOURCE_PATH"
    exit 1
fi

echo "✅ 构建完成！"
echo ""
echo "📍 应用位置："
echo "   $SOURCE_PATH"
echo ""
