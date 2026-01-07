@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ╔═══════════════════════════════════════════╗
echo ║       JD Notes 打包发布脚本 v1.0          ║
echo ╚═══════════════════════════════════════════╝
echo.

:: 检查是否在项目根目录
if not exist "src-tauri\tauri.conf.json" (
    echo [错误] 请在项目根目录下运行此脚本！
    pause
    exit /b 1
)

:: 获取当前版本号
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" src-tauri\tauri.conf.json') do (
    set "CURRENT_VERSION=%%~a"
    goto :found_version
)
:found_version
echo 当前版本: v%CURRENT_VERSION%

:: 询问新版本号
set /p "NEW_VERSION=请输入新版本号 (回车保持 %CURRENT_VERSION%): "
if "%NEW_VERSION%"=="" set "NEW_VERSION=%CURRENT_VERSION%"

echo.
echo 准备构建版本: v%NEW_VERSION%
echo.

:: 检查签名密钥
set "KEY_FILE=%~dp0..\~\.tauri\jdnotes.key"
if exist "%KEY_FILE%" (
    echo [成功] 找到签名密钥
    for /f "delims=" %%i in (%KEY_FILE%) do set "TAURI_SIGNING_PRIVATE_KEY=!TAURI_SIGNING_PRIVATE_KEY!%%i"
) else (
    echo [警告] 未找到签名密钥: %KEY_FILE%
    echo 如需签名，请先运行: pnpm tauri signer generate -w "%KEY_FILE%"
    echo.
)

:: 更新版本号（如果变化）
if not "%NEW_VERSION%"=="%CURRENT_VERSION%" (
    echo [步骤] 更新版本号...
    powershell -Command "(Get-Content 'src-tauri\tauri.conf.json' -Raw) -replace '\"version\": \"[^\"]*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content 'src-tauri\tauri.conf.json' -Encoding UTF8"
    powershell -Command "(Get-Content 'package.json' -Raw) -replace '\"version\": \"[^\"]*\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content 'package.json' -Encoding UTF8"
    echo [成功] 版本号已更新
)

:: 安装依赖
echo.
echo [步骤] 安装依赖...
call pnpm install
if errorlevel 1 (
    echo [错误] 依赖安装失败！
    pause
    exit /b 1
)

:: 构建
echo.
echo [步骤] 开始构建...
echo 这可能需要几分钟，请耐心等待...
echo.
call pnpm tauri build
if errorlevel 1 (
    echo [错误] 构建失败！
    pause
    exit /b 1
)

:: 整理输出
echo.
echo [步骤] 整理输出文件...
set "RELEASE_DIR=release\v%NEW_VERSION%"
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

:: 复制文件
set "BUNDLE_DIR=src-tauri\target\release\bundle"

:: 复制 NSIS 安装包
for %%f in ("%BUNDLE_DIR%\nsis\*.exe") do (
    copy "%%f" "%RELEASE_DIR%\" >nul
    echo   √ 复制: %%~nxf
)

:: 复制更新包
for %%f in ("%BUNDLE_DIR%\nsis\*.nsis.zip") do (
    copy "%%f" "%RELEASE_DIR%\" >nul
    echo   √ 复制: %%~nxf
)

:: 复制签名
for %%f in ("%BUNDLE_DIR%\nsis\*.nsis.zip.sig") do (
    copy "%%f" "%RELEASE_DIR%\" >nul
    echo   √ 复制: %%~nxf
)

:: 生成 latest.json
echo.
echo [步骤] 生成 latest.json...

:: 读取签名内容
set "SIGNATURE="
for %%f in ("%RELEASE_DIR%\*.nsis.zip.sig") do (
    for /f "delims=" %%s in (%%f) do set "SIGNATURE=%%s"
)

:: 获取更新包文件名
for %%f in ("%RELEASE_DIR%\*.nsis.zip") do set "UPDATE_FILE=%%~nxf"

:: 创建 latest.json
(
echo {
echo   "version": "%NEW_VERSION%",
echo   "notes": "## v%NEW_VERSION% 更新内容\n\n- 功能改进\n- Bug 修复",
echo   "pub_date": "%date:~0,4%-%date:~5,2%-%date:~8,2%T00:00:00Z",
echo   "platforms": {
echo     "windows-x86_64": {
echo       "signature": "%SIGNATURE%",
echo       "url": "https://github.com/你的用户名/jdnotes/releases/download/v%NEW_VERSION%/%UPDATE_FILE%"
echo     }
echo   }
echo }
) > "%RELEASE_DIR%\latest.json"

echo.
echo ═══════════════════════════════════════════════════════════════
echo                      打包完成！
echo ═══════════════════════════════════════════════════════════════
echo.
echo 输出目录: %RELEASE_DIR%
echo.
echo 生成的文件:
dir /b "%RELEASE_DIR%"
echo.
echo 下一步操作:
echo   1. 编辑 %RELEASE_DIR%\latest.json 填写更新说明
echo   2. 修改 latest.json 中的下载 URL
echo   3. 上传到 GitHub Releases
echo.

:: 打开输出目录
set /p "OPEN_DIR=是否打开输出目录? (y/n): "
if /i "%OPEN_DIR%"=="y" explorer "%RELEASE_DIR%"

echo.
echo 完成！
pause
