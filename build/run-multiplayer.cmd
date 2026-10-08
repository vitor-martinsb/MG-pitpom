@echo off
cd /d "%~dp0.."
python build\multiplayer.py start
if errorlevel 1 pause
