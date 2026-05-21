@echo off
chcp 65001 > nul
title SurfBook 서버

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
set "MVN=C:\Program Files\JetBrains\IntelliJ IDEA Community Edition 2024.3.4.1\plugins\maven\lib\maven3\bin\mvn.cmd"
set "PROJECT=C:\Users\sunghoon\surf-management-mobile"
set "LOG=%PROJECT%\server.log"

echo.
echo  ================================
echo    SurfBook 서버 시작 중...
echo  ================================
echo.

:: 기존 8084 포트 프로세스 종료
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8084 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
)

:: 로그 초기화 (이전 실행 로그 제거)
echo. > "%LOG%"

:: 서버를 별도 최소화 창에서 독립 실행
start "SurfBook Server" /min cmd /c "set JAVA_HOME=%JAVA_HOME% && "%MVN%" -f "%PROJECT%\pom.xml" spring-boot:run > "%LOG%" 2>&1"

echo  서버가 시작될 때까지 기다리는 중...
echo  (보통 15~30초 소요)
echo.

:: 서버 준비될 때까지 대기
:wait
timeout /t 3 /nobreak > nul
findstr /C:"Started SurfShopApplication" "%LOG%" > nul 2>&1
if not errorlevel 1 goto opened

findstr /C:"BUILD FAILURE" "%LOG%" > nul 2>&1
if not errorlevel 1 (
    echo.
    echo  [오류] 서버 실행 실패. 아래 로그를 확인하세요:
    echo  %LOG%
    echo.
    pause
    exit /b 1
)

findstr /C:"Cannot load driver" "%LOG%" > nul 2>&1
if not errorlevel 1 (
    echo.
    echo  [오류] DB 드라이버 오류. server.log를 확인하세요.
    echo.
    pause
    exit /b 1
)

echo  대기 중...
goto wait

:opened
echo.
echo  ================================
echo    서버 시작 완료!
echo    http://localhost:8084
echo  ================================
echo.

timeout /t 1 /nobreak > nul
start "" "http://localhost:8084/guest.html"
timeout /t 1 /nobreak > nul
start "" "http://localhost:8084/admin.html"

echo  브라우저가 열렸습니다.
echo.
echo  서버는 백그라운드 (최소화 창)에서 실행 중입니다.
echo  종료하려면 작업 표시줄의 [SurfBook Server] 창을 닫으세요.
echo.
pause
