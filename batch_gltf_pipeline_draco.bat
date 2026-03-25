@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "INPUT_FOLDER=%~1"
set "OUTPUT_FOLDER=%~2"

if "%INPUT_FOLDER%"=="" (
  echo Usage: batch_gltf_pipeline_draco.bat C:\path\to\glb C:\path\to\output
  echo 支持递归子目录，保留目录结构
  exit /b 1
)
if "%OUTPUT_FOLDER%"=="" (
  echo Usage: batch_gltf_pipeline_draco.bat C:\path\to\glb C:\path\to\output
  exit /b 1
)

if not exist "%INPUT_FOLDER%" (
  echo Error: 输入目录不存在: %INPUT_FOLDER%
  exit /b 1
)

where gltf-pipeline >nul 2>nul
if errorlevel 1 (
  echo Error: 未找到 gltf-pipeline，请先安装：npm i -g gltf-pipeline
  exit /b 1
)

if not exist "%OUTPUT_FOLDER%" mkdir "%OUTPUT_FOLDER%"

set /a count=0
set /a failed=0
set "LOG_FILE=%TEMP%\gltf_pipeline_%RANDOM%_%RANDOM%.log"

for /R "%INPUT_FOLDER%" %%F in (*.glb *.GLB) do (
  set "FULL=%%~fF"
  set "REL=!FULL:%INPUT_FOLDER%=!"
  if "!REL:~0,1!"=="\" set "REL=!REL:~1!"

  echo !REL! | findstr /I /C:"__MACOSX\" >nul
  if errorlevel 1 (
    set "NAME=%%~nF"
    if /I not "!NAME:~0,2!"=="._" (
      for %%D in ("!REL!") do set "REL_DIR=%%~dpD"
      set "OUT_DIR=%OUTPUT_FOLDER%\!REL_DIR!"
      if not exist "!OUT_DIR!" mkdir "!OUT_DIR!"
      set "OUT_FILE=!OUT_DIR!!NAME!.glb"

      echo Draco: !REL! -^> !REL_DIR!!NAME!.glb
      gltf-pipeline -i "%%~fF" -o "!OUT_FILE!" -d >"!LOG_FILE!" 2>&1
      if errorlevel 1 (
        set /a failed+=1
        echo   ^^ 失败
        type "!LOG_FILE!"
      ) else (
        set /a count+=1
      )
    )
  )
)

if exist "%LOG_FILE%" del /q "%LOG_FILE%" >nul 2>nul

echo.
echo 完成: 成功 !count! 个, 失败 !failed! 个
exit /b 0
