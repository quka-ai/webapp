#!/bin/bash

# QukaAI 桌面应用打包脚本
# 用于创建可分发的 DMG 安装包

set -e

echo "📦 QukaAI 桌面应用打包工具"
echo ""

# 配置
APP_NAME="QukaAI.app"
APP_PATH="quka-desktop/build/bin/$APP_NAME"
# ARCH=$(uname -m)
DMG_NAME="QukaAI-macOS-universal.dmg"
BUILD_DIR="quka-desktop/build/bin"
OUTPUT_DMG="$BUILD_DIR/$DMG_NAME"

# 检查应用是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 应用未找到: $APP_PATH"
    echo "💡 请先运行: npm run build:desktop"
    exit 1
fi

echo "📍 应用路径: $APP_PATH"
echo "📦 输出文件: $OUTPUT_DMG"
echo ""

# 可选：代码签名（如果有本地证书）
read -p "是否要对应用进行签名？(y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔐 查找可用的签名证书..."

    # 列出所有可用的签名证书
    security find-identity -v -p codesigning

    echo ""
    read -p "请输入证书名称（或按 Enter 跳过）: " CERT_NAME

    if [ -n "$CERT_NAME" ]; then
        echo "🔏 正在签名应用..."
        codesign --deep --force --verbose --sign "$CERT_NAME" "$APP_PATH"

        if [ $? -eq 0 ]; then
            echo "✅ 签名成功"
            # 验证签名
            codesign --verify --verbose "$APP_PATH"
        else
            echo "⚠️  签名失败，将使用未签名的应用"
        fi
    fi
else
    echo "⏭️  跳过签名步骤"
    echo ""
    echo "💡 提示：未签名的应用在其他电脑上首次打开时需要："
    echo "   1. 右键点击应用 → 选择'打开'"
    echo "   2. 或在 系统偏好设置 → 隐私与安全性 → 点击'仍要打开'"
fi

echo ""

# 创建 DMG
echo "📦 创建 DMG 安装包..."

# 删除旧文件
rm -f "$OUTPUT_DMG" "$BUILD_DIR/temp.dmg" 2>/dev/null

# 创建临时 DMG
hdiutil create \
    -volname "QukaAI Installer" \
    -srcfolder "$APP_PATH" \
    -ov \
    -format UDRW \
    "$BUILD_DIR/temp.dmg"

# 转换为压缩格式
hdiutil convert \
    "$BUILD_DIR/temp.dmg" \
    -format UDZO \
    -o "$OUTPUT_DMG"

# 清理临时文件
rm -f "$BUILD_DIR/temp.dmg"

# 获取文件大小
DMG_SIZE=$(du -h "$OUTPUT_DMG" | cut -f1)

echo ""
echo "✅ 打包完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 安装包信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "文件名: $DMG_NAME"
echo "位置:   $OUTPUT_DMG"
echo "大小:   $DMG_SIZE"
echo "架构:   $ARCH"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 分发指南"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  发送给接收方"
echo "   将 $DMG_NAME 通过以下方式发送："
echo "   • 邮件附件"
echo "   • 云盘分享（推荐：百度网盘、阿里云盘）"
echo "   • AirDrop（局域网）"
echo ""
echo "2️⃣  接收方安装步骤"
echo "   a) 双击 $DMG_NAME"
echo "   b) 将 QukaAI.app 拖拽到 Applications 文件夹"
echo "   c) 弹出 QukaAI Installer 磁盘映像"
echo "   d) 打开 Applications 文件夹，找到 QukaAI"
echo ""
echo "3️⃣  首次启动（重要！）"
echo "   ⚠️  不要双击打开！请按以下步骤："
echo ""
echo "   方法一（推荐）："
echo "   • 右键点击 QukaAI 应用"
echo "   • 选择'打开'"
echo "   • 在弹出的对话框中点击'打开'"
echo ""
echo "   方法二："
echo "   • 双击应用（会提示无法验证）"
echo "   • 打开 系统偏好设置 → 隐私与安全性"
echo "   • 找到 QukaAI 的提示，点击'仍要打开'"
echo ""
echo "4️⃣  后续使用"
echo "   首次打开后，以后就可以正常双击启动了"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 常见问题"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Q: 为什么需要右键打开？"
echo "A: macOS 的 Gatekeeper 会阻止未经 Apple 公证的应用"
echo "   右键打开可以绕过这个限制"
echo ""
echo "Q: 是否安全？"
echo "A: 是的，这是你自己构建的应用，完全可信"
echo "   右键打开只是告诉系统你确认信任这个应用"
echo ""
echo "Q: 如何在其他架构的 Mac 上运行？"
echo "A: 需要在对应架构的电脑上重新构建"
echo "   • Intel Mac (x86_64) 和 Apple Silicon (arm64) 不兼容"
echo "   • 或者使用 Rosetta 2 转译（性能会下降）"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
