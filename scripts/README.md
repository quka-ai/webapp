# Docker 构建脚本

此目录包含用于构建 Quka Web 前端多架构 Docker 镜像的脚本。

## 脚本说明

### build-multiarch.sh (推荐)
一个全面的多架构构建脚本，支持 ARM64 和 x86_64 平台。

**用法：**
```bash
./build-multiarch.sh <镜像项目> <版本> [架构] [选项]
```

**参数：**
- `镜像项目`: Docker 仓库项目名 (例如：`myregistry/myproject`)
- `版本`: 镜像版本标签 (例如：`v1.0.0`, `latest`)
- `架构`: 目标架构 (可选，默认：`both`)
  - `amd64`: 构建 x86_64 架构
  - `arm64`: 构建 ARM64 架构  
  - `both`: 构建两种架构

**选项：**
- `--push`: 构建后推送镜像到仓库
- `--local`: 在本地构建和加载镜像 (默认行为)
- `--no-cache`: 不使用缓存进行构建
- `--help`: 显示帮助信息

**使用示例：**

```bash
# 仅构建 ARM64 (本地)
./build-multiarch.sh myregistry/quka v1.0.0 arm64

# 构建 x86_64 并推送到仓库
./build-multiarch.sh myregistry/quka v1.0.0 amd64 --push

# 构建两种架构并推送
./build-multiarch.sh myregistry/quka v1.0.0 both --push

# 本地构建两种架构
./build-multiarch.sh myregistry/quka v1.0.0 both --local

# 不使用缓存构建
./build-multiarch.sh myregistry/quka v1.0.0 both --no-cache --push
```

### build-image.sh (旧版)
为了向后兼容，旧版构建脚本现在会调用 `build-multiarch.sh`。

**用法：**
```bash
./build-image.sh <镜像项目> <版本> [架构]
```

## 前置要求

1. **支持 buildx 的 Docker**: 确保安装了支持 buildx 的 Docker (推荐 Docker 19.03+)
2. **QEMU 交叉编译支持** (如果在不同架构上构建):
   ```bash
   docker run --privileged --rm tonistiigi/binfmt --install all
   ```

## 多架构构建过程

脚本使用 Docker buildx 创建多平台镜像：

1. 创建专用的 buildx 构建器实例
2. 为指定架构构建镜像
3. 可以将多清单镜像推送到仓库或本地构建
4. 通过环境变量支持代理设置

## 环境变量

- `HTTP_PROXY`: Docker 构建的 HTTP 代理
- `HTTPS_PROXY`: Docker 构建的 HTTPS 代理

## 输出

对于推送的镜像，您可以检查可用的架构：
```bash
docker buildx imagetools inspect myregistry/quka/quka-web:v1.0.0
```

## 故障排除

1. **"docker buildx 不可用"**: 更新 Docker 到支持 buildx 的版本
2. **交叉编译问题**: 安装 QEMU 模拟 (参见前置要求)
3. **构建器问题**: 删除并重新创建构建器：`docker buildx rm quka-multiarch-builder`

## 注意事项

- 您的 Dockerfile 已经配置了多架构构建，包含正确的 `BUILDPLATFORM` 和 `TARGETPLATFORM` 参数
- 脚本自动处理平台特定的构建
- 本地构建为每个架构创建单独的标记镜像
- 推送构建创建单个多平台清单