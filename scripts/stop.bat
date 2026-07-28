@echo off
echo Stopping Anvil Server...

echo Calling shutdown API endpoint...
curl -X POST http://localhost:3000/api/shutdown 2>nul

echo Waiting for graceful shutdown...
timeout /t 3 /nobreak > nul

echo Checking if Anvil server is still running on port 3000...
netstat -ano | findstr :3000 > nul
if %errorlevel% equ 0 (
    echo Anvil server still detected on port 3000, attempting targeted shutdown...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        echo Stopping process %%a...
        taskkill /f /pid %%a 2>nul
    )
) else (
    echo Anvil server appears to have stopped gracefully.
)

echo Anvil has been stopped.