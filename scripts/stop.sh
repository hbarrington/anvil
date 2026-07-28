#!/bin/bash

echo "Stopping Anvil Server..."

echo "Calling shutdown API endpoint..."
curl -X POST http://localhost:3000/api/shutdown 2>/dev/null

echo "Waiting for graceful shutdown..."
sleep 3

echo "Forcefully stopping any remaining Node.js processes..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ts-node.*server" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

echo "Anvil has been stopped."