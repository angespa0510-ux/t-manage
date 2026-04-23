@echo off
chcp 65001 > nul
REM ─── T-MANAGE iPhone CTI Bridge を Windows スタートアップに登録 ───
REM PC 起動時に自動で Bridge を起動するためのショートカットを作成します

set SCRIPT_DIR=%~dp0
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP%\T-MANAGE_iPhone_CTI_Bridge.lnk
set TARGET=%SCRIPT_DIR%start-bridge.bat

powershell -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%SHORTCUT%'); ^
   $s.TargetPath = '%TARGET%'; ^
   $s.WorkingDirectory = '%SCRIPT_DIR%'; ^
   $s.WindowStyle = 7; ^
   $s.Description = 'T-MANAGE iPhone CTI Bridge (Beta)'; ^
   $s.Save()"

if errorlevel 1 (
    echo [ERROR] ショートカット作成に失敗しました
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  スタートアップ登録完了
echo ============================================================
echo  登録先: %SHORTCUT%
echo.
echo  次回 Windows 起動時から自動的に Bridge が起動します。
echo  登録を解除するには、上記ファイルを削除してください。
echo ============================================================
pause
