@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "INPUT_FOLDER=%~1"
set "OUTPUT_FOLDER=%~2"

if "%INPUT_FOLDER%"=="" (
  echo Usage: batch_fbx2glb_final.bat C:\path\to\fbx C:\path\to\final_glb
  echo 一步完成：FBX -^> GLB -^> gltfpack 压缩
  exit /b 1
)
if "%OUTPUT_FOLDER%"=="" (
  echo Usage: batch_fbx2glb_final.bat C:\path\to\fbx C:\path\to\final_glb
  echo 一步完成：FBX -^> GLB -^> gltfpack 压缩
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
if not exist "%SCRIPT_DIR%batch_fbx2glb.bat" (
  echo Error: 缺少脚本 batch_fbx2glb.bat
  exit /b 1
)
if not exist "%SCRIPT_DIR%batch_gltfpack.bat" (
  echo Error: 缺少脚本 batch_gltfpack.bat
  exit /b 1
)

set "TMP_GLB_DIR=%TEMP%\fbx2glb_tmp_%RANDOM%_%RANDOM%"
if exist "%TMP_GLB_DIR%" rd /s /q "%TMP_GLB_DIR%"
mkdir "%TMP_GLB_DIR%" >nul 2>nul

echo Step 1/2: FBX -^> GLB (临时目录)
call "%SCRIPT_DIR%batch_fbx2glb.bat" "%INPUT_FOLDER%" "%TMP_GLB_DIR%"
if errorlevel 1 (
  rd /s /q "%TMP_GLB_DIR%" >nul 2>nul
  exit /b 1
)

echo.
echo Step 2/2: gltfpack 压缩 -^> 最终目录
call "%SCRIPT_DIR%batch_gltfpack.bat" "%TMP_GLB_DIR%" "%OUTPUT_FOLDER%"
set "STEP2_CODE=%ERRORLEVEL%"

rd /s /q "%TMP_GLB_DIR%" >nul 2>nul
if not "%STEP2_CODE%"=="0" exit /b %STEP2_CODE%

echo.
echo 清理: 删除与 FBX 同名的 .fbm 目录
set /a cleaned=0
for /R "%INPUT_FOLDER%" %%F in (*.fbx *.FBX) do (
  set "FBM_DIR=%%~dpnF.fbm"
  if exist "!FBM_DIR!\" (
    rd /s /q "!FBM_DIR!" >nul 2>nul
    if not exist "!FBM_DIR!\" set /a cleaned+=1
  )
)
echo 清理完成: 删除 !cleaned! 个 .fbm 目录

echo.
echo 全部完成，输出目录: %OUTPUT_FOLDER%
exit /b 0
