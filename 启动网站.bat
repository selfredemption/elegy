@echo off
chcp 65001 >nul
title 天梯挽歌 · 本地服务器
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [没找到 Node.js]
  echo 这台电脑需要先安装 Node.js 才能启动服务器。
  echo 下载地址：https://nodejs.org/  （选 LTS 版本，一路下一步即可）
  echo.
  echo 或者：直接双击 index.html 也能看，只是手机访问不了。
  echo.
  pause
  exit /b 1
)

node "_server.js"
if errorlevel 1 pause
