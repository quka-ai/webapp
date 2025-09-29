#!/bin/bash
# Legacy build script - now calls the multi-arch script for x86_64
# For multi-architecture builds, use build-multiarch.sh instead

IMAGE_PROJECT=$1
VERSION=$2
ARCHITECTURE=${3:-amd64}

if [ -z "$IMAGE_PROJECT" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <image_project> <version> [architecture]"
    echo "For advanced multi-arch builds, use: build-multiarch.sh"
    exit 1
fi

echo "Using legacy build script - calling build-multiarch.sh for better multi-platform support"

# Call the new multi-arch script with push option
exec "$(dirname "$0")/build-multiarch.sh" "$IMAGE_PROJECT" "$VERSION" "$ARCHITECTURE" --push
