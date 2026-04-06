@echo off
chcp 65001 >nul
title 🎬 AI動画生成 監視中...
echo.
echo ========================================
echo   🎬 AI動画生成 自動監視
echo   閉じるには Ctrl+C または ×ボタン
echo ========================================
echo.

cd /d "%~dp0"
npm run watch

pause
