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
echo Build complete. Run with:
echo   docker run -p 3000:3000 textboard:latest
echo.
echo Or with docker-compose:
echo   docker-compose up -d
