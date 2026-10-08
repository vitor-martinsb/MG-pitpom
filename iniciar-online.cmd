@echo off
cd /d "%~dp0"
python build\share-multiplayer.py
if errorlevel 1 pause
