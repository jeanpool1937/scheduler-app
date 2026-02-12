@echo off
echo ========================================================
echo                 DESPLIEGUE DEL PROGRAMADOR
echo ========================================================
echo.
echo 1. Guardando cambios locales en Git...
git add .
set /p commit_msg="Introduce un mensaje para estos cambios (Enter para usar fecha/hora): "

if "%commit_msg%"=="" set commit_msg=Actualizacion automatica %date% %time%

git commit -m "%commit_msg%"
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] No hubo cambios nuevos para guardar o ocurrio un error en git commit.
    echo Continuamos con el despliegue...
)

echo.
echo 2. Subiendo cambios a GitHub (rama main)...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] No se pudo subir a main. Verifica tu conexion.
    pause
    exit /b
)

echo.
echo 3. Construyendo y desplegando a GitHub Pages...
call npm run deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo             [EXITO] DESPLIEGUE COMPLETADO
    echo ========================================================
    echo Tu web estara actualizada en 1-2 minutos.
) else (
    echo.
    echo ========================================================
    echo             [ERROR] EL DESPLIEGUE FALLO
    echo ========================================================
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
