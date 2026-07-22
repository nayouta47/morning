@echo off
rem =====================================================================
rem  morning launcher  (double-click to run)
rem  Starts the Vite dev server and opens the app in your browser.
rem  Note: this app is served under the /morning/ base path; --open goes
rem  straight there. Keep this file ASCII-only.
rem =====================================================================
title morning
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto no_node

if not exist "node_modules" goto install
goto run

:install
echo [setup] Installing dependencies. This happens only on the first run...
call npm install
if errorlevel 1 goto install_failed
goto run

:run
echo [start] Starting the dev server. Your browser will open automatically.
echo         Keep this window open while using the app. Press Ctrl+C to stop.
echo.
call npm run dev -- --open
echo.
echo [stopped] The dev server has exited.
pause
exit /b 0

:no_node
echo [ERROR] Node.js was not found on PATH.
echo         Install the LTS build from https://nodejs.org and try again.
pause
exit /b 1

:install_failed
echo [ERROR] "npm install" failed. Review the messages above.
pause
exit /b 1
