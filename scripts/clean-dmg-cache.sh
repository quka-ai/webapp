#!/bin/bash

# QukaAI DMG 缓存清理脚本
# 用于清除 macOS Finder 对 DMG 的缓存，确保新的布局设置生效

echo "🧹 清理 DMG 和 Finder 缓存..."
echo ""

remove_path() {
    local target="$1"
    if [ -e "$target" ]; then
        chmod -R u+rwX "$target" 2>/dev/null || true
        rm -rf "$target"
    fi
}

# 1. 卸载所有已挂载的 QukaAI Installer
echo "📤 卸载已挂载的 DMG..."
hdiutil detach "/Volumes/QukaAI Installer" 2>/dev/null && echo "  ✓ 已卸载" || echo "  ℹ️  没有已挂载的 DMG"

# 2. 删除旧的 DMG 文件
echo "🗑️  删除旧的 DMG 文件..."
rm -f quka-desktop/build/bin/QukaAI-macOS-universal.dmg
rm -f quka-desktop/build/bin/temp.dmg
remove_path quka-desktop/build/bin/dmg_staging
echo "  ✓ 旧文件已删除"

# 3. 清除 Finder 的 .DS_Store 缓存
echo "💾 清理 .DS_Store 文件..."
find quka-desktop/build/bin -name ".DS_Store" -delete 2>/dev/null
echo "  ✓ .DS_Store 已清理"

# 4. 清除 Finder 图标缓存（可选，需要管理员权限）
read -p "是否清除系统图标缓存？这将重启 Finder (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 清除图标缓存并重启 Finder..."
    sudo rm -rf /Library/Caches/com.apple.iconservices.store
    killall Finder
    echo "  ✓ Finder 已重启"
else
    echo "  ⏭️  跳过图标缓存清理"
fi

echo ""
echo "✅ 缓存清理完成！"
echo ""
echo "💡 下一步："
echo "   运行: npm run package:desktop"
echo "   打开新的 DMG 时，应该能看到更新的布局"
