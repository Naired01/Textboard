@echo off
echo === Textboard Build (Windows) ===

where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Docker is not installed
    exit /b 1
)

echo Building Docker image...
docker build -t textboard:latest .

if %ERRORLEVEL% neq 0 (
    echo Build failed
    exit /b 1
)

echo.
echo Build complete.
echo.
echo Run with docker-compose (recommended):
echo   docker-compose up -d
echo.
echo Or with docker run:
echo   docker run -p 3000:3000 -v .\data:/app/data -e DB_PATH=/app/data/textboard.db textboard:latest
echo.
echo Database will be stored in .\data\textboard.db
