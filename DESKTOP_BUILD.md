# QukaAI Desktop App Build Guide

## Overview

QukaAI desktop application is built using [Wails](https://wails.io/), a framework that combines Go backend with web frontend technologies. This guide covers both local and automated builds.

## Prerequisites

### Local Development

- **Node.js**: v20+ (for frontend build)
- **Go**: v1.21+ (for Wails backend)
- **Wails CLI**: Install via `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Platform-specific Requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Windows:**
- GCC compiler (e.g., MinGW-w64)
- NSIS (for creating installers)

**Linux:**
- GTK3 development files: `sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev`

## Local Build

### Quick Build

```bash
# Build and package in one command
npm run build:desktop
```

This will:
1. Build the frontend (`npm run build-beta`)
2. Copy assets to Wails project
3. Build the Wails application
4. Create `QukaAI.app` in `quka-desktop/build/bin/`

### Build for Specific Architecture

```bash
cd quka-desktop

# Apple Silicon (M1/M2/M3)
./build.sh --arch arm64

# Intel Mac
./build.sh --arch amd64

# Universal Binary (both architectures)
./build.sh --arch universal
```

### Create Distributable Package

**macOS only:**
```bash
npm run package:desktop
```

This creates a `.dmg` installer that can be shared with others.

## GitHub Actions (Automated Build)

### Triggering a Build

#### Method 1: Release Tag (Recommended)

```bash
# 1. Update version in quka-desktop/wails.json
# "productVersion": "v0.2.8"

# 2. Commit changes
git add quka-desktop/wails.json
git commit -m "Bump version to v0.2.8"

# 3. Create and push tag
git tag v0.2.8
git push origin v0.2.8

# 4. GitHub Actions will automatically:
#    - Build for macOS, Windows, Linux
#    - Create a GitHub Release
#    - Upload installers to the release
```

#### Method 2: Manual Trigger

1. Go to [GitHub Actions](../../actions/workflows/desktop-build.yml)
2. Click "Run workflow"
3. (Optional) Enter a version string
4. Click "Run workflow" button

### What Gets Built

The workflow creates builds for:

| Platform | File | Size (approx) |
|----------|------|---------------|
| macOS (Universal) | `QukaAI-macOS-universal.dmg` | ~80 MB |
| Windows (x64) | `QukaAI-Windows-x64-installer.exe` | ~70 MB |
| Linux (x64) | `QukaAI-Linux-x64.tar.gz` | ~60 MB |

### Download Built Apps

**From Workflow Artifacts:**
1. Go to Actions → Select workflow run
2. Scroll to "Artifacts" section
3. Download platform-specific builds
4. Note: Artifacts are kept for 7 days

**From GitHub Releases:**
1. Go to [Releases](../../releases)
2. Find your version (e.g., v0.2.8)
3. Download from "Assets" section
4. Note: Release files are permanent

## Installation Guide

### macOS

**Developer Installation (unsigned app):**

1. Download `QukaAI-macOS-universal.dmg`
2. Double-click to mount the DMG
3. Drag `QukaAI.app` to Applications folder
4. **First launch**:
   - Right-click `QukaAI.app` → "Open"
   - Click "Open" in the security dialog
   - (This is required because the app is unsigned)
5. Subsequent launches: Double-click normally

**Alternative method:**
```bash
# Remove quarantine attribute
xattr -cr /Applications/QukaAI.app
```

### Windows

1. Download `QukaAI-Windows-x64-installer.exe`
2. Double-click the installer
3. Follow installation wizard
4. If Windows SmartScreen appears:
   - Click "More info"
   - Click "Run anyway"
   - (This is normal for unsigned apps)

### Linux

```bash
# 1. Download and extract
wget https://github.com/[YOUR_ORG]/webapp/releases/download/v0.2.8/QukaAI-Linux-x64.tar.gz
tar -xzf QukaAI-Linux-x64.tar.gz

# 2. Make executable
chmod +x QukaAI

# 3. Run
./QukaAI
```

## Project Structure

```
webapp/
├── quka-desktop/           # Wails project
│   ├── wails.json         # Wails configuration
│   ├── main.go            # Go backend entry point
│   ├── app.go             # Application logic
│   ├── build.sh           # Build script
│   ├── copy-assets.sh     # Asset copying script
│   ├── icon.icns          # macOS icon
│   └── frontend/          # Symlink/copy of built frontend
├── src/                   # React frontend source
├── dist/                  # Built frontend (after npm build)
├── scripts/
│   ├── build-desktop.sh   # Wrapper for desktop build
│   └── package-desktop.sh # DMG packaging script
└── .github/workflows/
    └── desktop-build.yml  # CI/CD workflow
```

## Versioning

Version is defined in [quka-desktop/wails.json](quka-desktop/wails.json):

```json
{
  "info": {
    "productVersion": "v0.2.7"
  }
}
```

**Version Format**: `vMAJOR.MINOR.PATCH` (e.g., `v0.2.7`)

## Troubleshooting

### Build Failures

**"wails: command not found"**
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
export PATH="$HOME/go/bin:$PATH"
```

**"frontend build failed"**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build-beta
```

**"rsync: command not found" (Windows)**
- Install rsync via Git Bash or WSL
- Or modify `copy-assets.sh` to use `xcopy`/`robocopy`

### macOS Gatekeeper Issues

**"QukaAI is damaged and can't be opened"**
```bash
# Remove quarantine attribute
xattr -cr /Applications/QukaAI.app
```

**"Apple cannot check it for malicious software"**
- Right-click → Open (don't double-click)
- Or: System Preferences → Security & Privacy → Click "Open Anyway"

### Code Signing (Optional)

For production releases, consider:

1. **macOS**:
   - Get Apple Developer ID certificate
   - Sign app: `codesign --deep --force --sign "Developer ID Application: Your Name" QukaAI.app`
   - Notarize with Apple

2. **Windows**:
   - Get Code Signing certificate
   - Use `signtool.exe` to sign the installer

## Build Performance

Typical build times on GitHub Actions:

- macOS: ~10-15 minutes
- Windows: ~8-12 minutes
- Linux: ~6-10 minutes

**Total workflow time**: ~15-20 minutes (builds run in parallel)

## FAQ

**Q: Can I build for Windows on macOS?**
A: Not easily. Cross-compilation for Windows requires specific setup. Use GitHub Actions or a Windows machine.

**Q: Why is the app so large?**
A: The bundle includes:
- Chromium-based WebView engine (on Windows)
- Go runtime
- All frontend assets and dependencies

**Q: How do I reduce build size?**
A:
- Enable obfuscation in `wails.json`: `"obfuscated": true`
- Optimize frontend bundle: Use tree-shaking, code splitting
- Compress assets

**Q: Can I auto-update the app?**
A: Wails doesn't have built-in auto-update. Consider:
- [go-update](https://github.com/inconshreveable/go-update)
- Custom update checker in your Go code

## Resources

- [Wails Documentation](https://wails.io/docs/introduction)
- [Wails Build Guide](https://wails.io/docs/reference/cli/#build)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Support

For build issues:
1. Check [GitHub Actions logs](../../actions)
2. Review error messages in workflow output
3. Test build locally first
4. Open an issue with build logs
