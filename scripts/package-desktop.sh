#!/bin/bash

# QukaAI 桌面应用打包脚本
# 用于创建可分发的 DMG 安装包

set -euo pipefail

echo "📦 QukaAI 桌面应用打包工具"
echo ""

# 配置
APP_NAME="QukaAI.app"
APP_PATH="quka-desktop/build/bin/$APP_NAME"
ARCH="universal"
DMG_NAME="QukaAI-macOS-universal.dmg"
BUILD_DIR="quka-desktop/build/bin"
OUTPUT_DMG="$BUILD_DIR/$DMG_NAME"

sign_app_bundle() {
    local app_path="$1"
    local identity="${CODESIGN_IDENTITY:-}"

    if ! command -v codesign >/dev/null 2>&1; then
        echo "❌ 找不到 codesign，无法生成可分发的 macOS app"
        exit 1
    fi

    if [ -z "$identity" ] && [ -t 0 ]; then
        read -p "请输入签名证书名称（直接回车使用 ad-hoc 签名）: " identity
    fi
    if [ -z "$identity" ]; then
        identity="-"
    fi

    echo "🔏 签名应用..."
    xattr -cr "$app_path" 2>/dev/null || true
    codesign --force --deep --sign "$identity" "$app_path"
    codesign --verify --deep --strict --verbose=2 "$app_path"

    if [ "$identity" = "-" ]; then
        echo "✅ 已使用 ad-hoc 签名修复应用封签"
        echo "ℹ️  对外分发仍建议设置 CODESIGN_IDENTITY 为 Developer ID Application 证书并完成 notarization"
    else
        echo "✅ 已使用证书签名：$identity"
    fi
}

remove_path() {
    local target="$1"
    if [ -e "$target" ]; then
        chmod -R u+rwX "$target" 2>/dev/null || true
        rm -rf "$target"
    fi
}

# 检查应用是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 应用未找到: $APP_PATH"
    echo "💡 请先运行: npm run build:desktop"
    exit 1
fi

echo "📍 应用路径: $APP_PATH"
echo "📦 输出文件: $OUTPUT_DMG"
echo ""

echo "🔐 可用签名证书："
security find-identity -v -p codesigning 2>/dev/null || true
echo ""
sign_app_bundle "$APP_PATH"

# 创建 DMG
echo "📦 创建 DMG 安装包..."

# 删除旧文件（包括 .DS_Store 等缓存文件）
rm -f "$OUTPUT_DMG" "$BUILD_DIR/temp.dmg" 2>/dev/null
rm -rf "$BUILD_DIR/.fseventsd" "$BUILD_DIR/.Spotlight-V100" 2>/dev/null

# 创建临时目录用于 DMG 内容
STAGING_DIR="$BUILD_DIR/dmg_staging"
remove_path "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# 复制应用到临时目录
echo "📋 准备 DMG 内容..."
ditto "$APP_PATH" "$STAGING_DIR/$APP_NAME"
codesign --verify --deep --strict --verbose=2 "$STAGING_DIR/$APP_NAME"

# 创建 Applications 文件夹的符号链接
echo "🔗 创建 Applications 快捷方式..."
ln -s /Applications "$STAGING_DIR/Applications"

# 创建临时 DMG
echo "🔨 生成 DMG 文件..."
hdiutil create \
    -volname "QukaAI Installer" \
    -srcfolder "$STAGING_DIR" \
    -ov \
    -format UDRW \
    "$BUILD_DIR/temp.dmg"

# 挂载临时 DMG 进行自定义
MOUNT_DIR=$(hdiutil attach -readwrite -noverify -noautoopen "$BUILD_DIR/temp.dmg" | grep Volumes | sed 's/.*\/Volumes/\/Volumes/')

if [ -n "$MOUNT_DIR" ]; then
    echo "🎨 自定义 DMG 外观..."

    # 设置 DMG 卷图标
    ICON_FILE="quka-desktop/icon.icns"
    if [ -f "$ICON_FILE" ]; then
        cp "$ICON_FILE" "$MOUNT_DIR/.VolumeIcon.icns"
        SetFile -c icnC "$MOUNT_DIR/.VolumeIcon.icns"
        SetFile -a C "$MOUNT_DIR"
        echo "  ✓ 卷图标已设置"
    fi

    # 设置 Finder 窗口属性并强制刷新
    echo "  → 配置窗口布局..."

    # 先删除旧的 .DS_Store
    rm -f "$MOUNT_DIR/.DS_Store"

    # 使用 AppleScript 设置窗口（分两步：打开设置，然后关闭）
    osascript <<EOF
tell application "Finder"
    tell disk "QukaAI Installer"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {400, 100, 980, 480}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 160
        set background color of viewOptions to {255, 255, 255}
        delay 2
        set position of item "QukaAI.app" of container window to {145, 180}
        try
            set position of item "Applications" of container window to {435, 180}
        on error errMsg
            log "Cannot set Applications position: " & errMsg
        end try
        update without registering applications
        delay 2
    end tell
end tell
EOF

    # 检查结果
    if [ $? -eq 0 ]; then
        echo "  ✓ 窗口布局已配置"
    else
        echo "  ⚠️  窗口布局配置失败"
    fi

    # 等待 Finder 写入 .DS_Store
    echo "  → 等待 Finder 写入设置..."
    sleep 3
    sync

    # 强制关闭窗口以确保 .DS_Store 被写入
    osascript -e 'tell application "Finder" to close window "QukaAI Installer"' 2>/dev/null || true
    sleep 1

    # 验证 .DS_Store 存在
    if [ -f "$MOUNT_DIR/.DS_Store" ]; then
        echo "  ✓ .DS_Store 已创建"
    else
        echo "  ⚠️  .DS_Store 未创建，布局可能不会保存"
    fi

    # 卸载
    echo "💾 保存更改..."
    hdiutil detach "$MOUNT_DIR" -quiet
    echo "✅ DMG 自定义完成"
fi

# 转换为压缩格式
echo "🗜️  压缩 DMG..."
hdiutil convert \
    "$BUILD_DIR/temp.dmg" \
    -format UDZO \
    -o "$OUTPUT_DMG"

# 清理临时文件
rm -f "$BUILD_DIR/temp.dmg"
remove_path "$STAGING_DIR"

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
