@echo off
title SurfBook Server Launcher

echo.
echo  ===================================
echo   SurfBook Starting...
echo  ===================================
echo.

start /D "%~dp0" "SurfBook Server" cmd /k gradlew.bat --no-daemon bootRun

echo  Waiting for server... (max 30s)

set /a COUNT=0
:WAIT
timeout /t 2 /nobreak >nul
set /a COUNT+=1
powershell -Command "try { (New-Object Net.Sockets.TcpClient('localhost', 8084)).Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto OPEN
if %COUNT% GEQ 20 goto TIMEOUT
goto WAIT

:OPEN
echo  Server is ready!
start "" "http://localhost:8084/guest.html"
timeout /t 1 /nobreak >nul
start "" "http://localhost:8084/admin.html"
echo.
echo  Guest : http://localhost:8084/guest.html
echo  Admin : http://localhost:8084/admin.html
echo.
goto END

:TIMEOUT
echo.
echo  [WARNING] Server did not respond in 40s.
echo  Check the SurfBook Server window for errors.
echo.
pause

:END
