# QukaAI Desktop App - 快速使用指南

## ✅ 已成功解决！

您的 Wails 桌面应用现在已经可以正常构建和运行了！

## 📁 应用位置

**应用包**：`build/bin/QukaAI.app`

您可以：
- 双击 `build/bin/QukaAI.app` 启动应用
- 或通过命令行启动：`open build/bin/QukaAI.app`

## 🚀 日常使用命令

### 1. 开发模式（推荐用于调试）
```bash
export PATH="$HOME/go/bin:$PATH"
wails dev
```
- 会在浏览器中打开应用
- 支持热重载

### 2. 生产构建（推荐）
```bash
./build-with-icon.sh
```
**这个脚本会自动**：
- 复制前端资源
- 构建应用
- **自动更新自定义图标** ✅

### 3. 手动构建（如果需要）
```bash
export PATH="$HOME/go/bin:$PATH"
./copy-assets.sh
wails build -clean
# 手动复制图标：
cp icon.icns build/bin/QukaAI.app/Contents/Resources/iconfile.icns
```

## 🔧 项目配置

### 前端资源路径
- **外部项目**：`../` （主项目的根目录）
- **构建输出**：`../dist/` （主项目的 dist 目录）
- **嵌入路径**：`frontend/dist/` （Wails 内部路径）

### 资源复制脚本
`copy-assets.sh` - 自动将外部项目的构建资源复制到 Wails 项目中

### 自动化构建脚本
`build-with-icon.sh` - **一键构建脚本**，自动完成：
1. 复制前端资源
2. 构建 Wails 应用
3. 更新自定义图标
4. 显示完成信息

**这是推荐的构建方式！**

### 图标配置
- 自定义图标已生成并应用
- 图标文件：`icon.icns`
- 应用内路径：`build/bin/QukaAI.app/Contents/Resources/iconfile.icns`

## 🎯 已解决的问题

✅ **资源路径问题** - 外部前端资源正确嵌入
✅ **构建闪退问题** - 应用可正常启动
✅ **图标显示问题** - 自定义图标已应用
✅ **多平台支持** - 支持 macOS ARM64

## 🐛 如果遇到问题

### 问题 1：应用无法启动
**解决方案**：
```bash
./copy-assets.sh
wails build -clean
```

### 问题 2：样式丢失
**解决方案**：
- 开发模式：`wails dev`（样式会自动加载）
- 生产模式：确保前端已正确构建

### 问题 3：图标不更新
**解决方案**：
- **使用推荐的构建方式**：`./build-with-icon.sh`（会自动更新图标）
- 手动更新：`cp icon.icns build/bin/QukaAI.app/Contents/Resources/iconfile.icns`
- Finder 可能需要刷新图标缓存
- 可以重启 Finder 或重新登录系统

### 问题 4：图标变成默认图标
**原因**：使用了 `wails build` 而没有手动更新图标文件
**解决方案**：使用 `build-with-icon.sh` 脚本构建，确保图标自动更新

## 📝 下一步

1. **测试功能** - 在您的 Mac 上测试应用的各种功能
2. **多平台构建** - 构建 Windows 和 Linux 版本：
   ```bash
   wails build -platform=windows/amd64
   wails build -platform=linux/amd64
   ```
3. **代码优化** - 修复 TypeScript 类型错误
4. **应用签名** - 如需分发，可能需要为应用签名

## 📞 技术支持

如有问题，请检查：
- `build.log` - 构建日志
- 应用运行日志 - 查看 Console.app
- 前端控制台 - 开发模式下 F12 查看

---

**状态**：✅ 应用已成功构建并可运行！
**最后更新**：2025-11-19
