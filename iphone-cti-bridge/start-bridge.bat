@echo off
chcp 65001 > nul
title T-MANAGE iPhone CTI Bridge

REM ─── 作業ディレクトリを自分のフォルダに ───
cd /d "%~dp0"

REM ─── Python インストール確認 ─────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python がインストールされていません。
    echo https://www.python.org/downloads/ から Python 3.10 以降をインストールしてください。
    echo インストール時は「Add Python to PATH」に必ずチェックを入れてください。
    pause
    exit /b 1
)

REM ─── 依存パッケージ確認 ─────────────────
python -c "import winsdk, requests, dotenv" >nul 2>&1
if errorlevel 1 (
    echo [INFO] 初回起動: 依存パッケージをインストールします...
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] パッケージのインストールに失敗しました。
        pause
        exit /b 1
    )
)

REM ─── .env 確認 ──────────────────────────
if not exist ".env" (
    echo [ERROR] .env ファイルが見つかりません。
    echo .env.example を .env にコピーして値を設定してください。
    pause
    exit /b 1
)

REM ─── 起動 ───────────────────────────────
echo.
echo T-MANAGE iPhone CTI Bridge を起動します...
echo 停止するには Ctrl+C を押してください。
echo.
python bridge.py

pause
