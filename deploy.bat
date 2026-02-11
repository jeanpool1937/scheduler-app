@echo off
echo ==========================================
echo      Iniciando Despliegue Automático
echo ==========================================
echo.
echo Ejecutando comando de despliegue...
call npm run deploy
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo [EXITO] Despliegue completado correctamente!
    echo ==========================================
) else (
    echo.
    echo ==========================================
    echo [ERROR] Algo salio mal. Revisa los mensajes arriba.
    echo ==========================================
)
echo.
echo Presiona cualquier tecla para salir...
pause >nul
