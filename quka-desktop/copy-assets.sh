#!/bin/bash

echo "Copying frontend assets..."
rm -rf frontend/dist
mkdir -p frontend/dist
rsync -av --delete ../dist/ frontend/dist/
echo "Assets copied successfully!"
