@echo off
chcp 65001 > nul
REM ─── PyInstaller で単体 exe 化 ───
REM 配布先 PC に Python が入っていない場合に使用

cd /d "%~dp0"

echo [1/3] PyInstaller をインストール...
python -m pip install --upgrade pip pyinstaller
if errorlevel 1 goto :error

echo [2/3] 依存パッケージをインストール...
python -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo [3/3] exe をビルド...
python -m PyInstaller ^
    --onefile ^
    --name "tmanage-iphone-cti-bridge" ^
    --icon=NONE ^
    --console ^
    --add-data ".env.example;." ^
    bridge.py
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  ビルド完了
echo  出力先: dist\tmanage-iphone-cti-bridge.exe
echo ============================================================
echo.
echo  配布時は以下をセットで渡してください:
echo   - dist\tmanage-iphone-cti-bridge.exe
echo   - .env.example (→ .env にリネームして設定)
echo   - README.md
echo ============================================================
pause
exit /b 0

:error
echo [ERROR] ビルドに失敗しました
pause
exit /b 1
