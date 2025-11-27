# GitHub Actions Workflows

This directory contains automated workflows for building and deploying QukaAI.

## Workflows

### 1. Desktop App Build (`desktop-build.yml`)

Builds QukaAI desktop applications for multiple platforms using Wails.

#### Trigger Conditions

- **Automatic**: When you push a git tag starting with `v` (e.g., `v0.2.7`)
- **Manual**: Via GitHub Actions UI (workflow_dispatch)

#### Platforms

The workflow builds for three platforms:

| Platform | OS | Architecture | Output |
|----------|-----|--------------|--------|
| macOS | macos-latest | Universal (Intel + Apple Silicon) | `.dmg` |
| Windows | windows-latest | x64 | `.exe` installer |
| Linux | ubuntu-latest | x64 | `.tar.gz` |

#### Build Process

1. **Setup Environment**
   - Checkout code
   - Install Node.js (v20)
   - Install Go (v1.21)
   - Install Wails CLI
   - Install platform-specific dependencies

2. **Build Frontend**
   - Install npm dependencies
   - Build React app with production config

3. **Build Desktop App**
   - Copy frontend assets to Wails project
   - Build Wails application for target platform
   - Package application (DMG/installer/tar.gz)

4. **Upload Artifacts**
   - Upload build artifacts to GitHub Actions
   - Create GitHub Release (if triggered by tag)

#### Usage

**Option 1: Create a Release Tag**

```bash
# Tag your commit
git tag v0.2.7
git push origin v0.2.7

# The workflow will automatically:
# 1. Build for all platforms
# 2. Create a GitHub Release
# 3. Upload all installers to the release
```

**Option 2: Manual Trigger**

1. Go to: Actions → Desktop App Build → Run workflow
2. Click "Run workflow" button
3. Optionally specify a version number

#### Artifacts

Build artifacts are available in two places:

1. **Workflow Artifacts** (retained for 7 days)
   - Go to: Actions → Select workflow run → Artifacts section
   - Download individual platform builds

2. **GitHub Releases** (permanent, if triggered by tag)
   - Go to: Releases → Select release
   - Download from release assets

#### Output Files

- **macOS**: `QukaAI-macOS-universal.dmg` (~50-100 MB)
- **Windows**: `QukaAI-Windows-x64-installer.exe` (~50-100 MB)
- **Linux**: `QukaAI-Linux-x64.tar.gz` (~50-100 MB)

#### Troubleshooting

**Build fails on macOS:**
- Check if `icon.icns` exists in `quka-desktop/`
- Verify `copy-assets.sh` has execute permissions

**Build fails on Windows:**
- Ensure Go version is compatible (1.21+)
- Check if NSIS installer settings are correct in `wails.json`

**Build fails on Linux:**
- GTK and WebKit dependencies must be installed
- Workflow already handles this via `apt-get install`

**Frontend build fails:**
- Check if `npm ci` completed successfully
- Verify all dependencies are in `package.json`
- Review `build-beta` script configuration

#### Local Testing

Before pushing a tag, test the build locally:

```bash
# Build frontend
npm run build-beta

# Build desktop app
npm run build:desktop

# Package (macOS only)
npm run package:desktop
```

### 2. Docker Build (`ghcr.yml`)

Builds and pushes Docker images to GitHub Container Registry.

**Trigger**: Push tags starting with `v`

---

## Secrets Configuration

No additional secrets are required. The workflows use:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- No code signing certificates (builds are unsigned)

## Future Enhancements

Potential improvements:

- [ ] Add code signing for macOS (requires Apple Developer certificate)
- [ ] Add Windows code signing (requires certificate)
- [ ] Notarize macOS app with Apple
- [ ] Add auto-update functionality
- [ ] Build ARM64 Linux binaries
- [ ] Add smoke tests before packaging
- [ ] Cache Go modules and npm dependencies
- [ ] Parallel builds for faster CI
