@REM ----------------------------------------------------------------------------
@REM Maven Start Up Batch script
@REM ----------------------------------------------------------------------------
@echo off
@setlocal

set MAVEN_WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
set MAVEN_OPTS_PROPS="%MAVEN_PROJECTBASEDIR%\.mvn\jvm.config"
set MAVEN_WRAPPER_PROPERTIES="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties"

set DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
set MAVEN_USER_HOME=%USERPROFILE%\.m2

@IF EXIST "%MAVEN_WRAPPER_JAR%" goto init

echo Downloading Maven Wrapper...
PowerShell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%MAVEN_WRAPPER_JAR%'"

:init
set JAVA_EXE=%JAVA_HOME%\bin\java.exe
if not exist "%JAVA_EXE%" set JAVA_EXE=java

"%JAVA_EXE%" -jar %MAVEN_WRAPPER_JAR% %*
