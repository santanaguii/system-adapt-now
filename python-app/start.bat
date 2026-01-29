@echo off
chcp 65001 >nul
title Meu Sistema - Notas e Atividades

echo ========================================
echo    Meu Sistema - Notas e Atividades
echo ========================================
echo.

:: Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale Python 3.10 ou superior.
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [OK] Python encontrado!

:: Criar ambiente virtual se não existir
if not exist "venv" (
    echo.
    echo [INFO] Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 (
        echo [ERRO] Falha ao criar ambiente virtual!
        pause
        exit /b 1
    )
    echo [OK] Ambiente virtual criado!
)

:: Ativar ambiente virtual
echo.
echo [INFO] Ativando ambiente virtual...
call venv\Scripts\activate.bat

:: Instalar/atualizar dependências
echo.
echo [INFO] Verificando dependencias...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas!

:: Criar pasta data se não existir
if not exist "data" (
    mkdir data
)

:: Abrir navegador após pequena pausa
echo.
echo [INFO] Abrindo navegador em http://localhost:8000
start "" http://localhost:8000

:: Iniciar servidor
echo.
echo ========================================
echo    Servidor iniciado!
echo    Acesse: http://localhost:8000
echo    Pressione Ctrl+C para parar
echo ========================================
echo.

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
