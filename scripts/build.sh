#!/bin/bash

echo "Building Anvil..."

echo "Installing all dependencies..."
npm run install:all

echo "Building TypeScript server..."
npm run build:server

echo "Building React client..."
npm run build

echo "Syncing package versions..."
npm run version:sync

echo "Build completed successfully!"
echo "Server compiled to: dist/"
echo "Client built to: client/dist/"