@echo off
echo Building Anvil...

echo Installing all dependencies...
call npm run install:all

echo Building TypeScript server...
call npm run build:server

echo Building React client...
call npm run build

echo Syncing package versions...
call npm run version:sync

echo Build completed successfully!
echo Server compiled to: dist/
echo Client built to: client/dist/