@echo off
echo Instalando dependencias...
call npm install

echo.
echo Iniciando servidor de desenvolvimento...
call npm run dev

pause
