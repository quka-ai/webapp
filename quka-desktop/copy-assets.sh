#!/bin/bash

echo "Copying frontend assets..."
mkdir -p frontend/dist
rsync -av --delete ../dist/ frontend/dist/
echo "Assets copied successfully!"
