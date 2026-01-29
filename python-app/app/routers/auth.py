from fastapi import APIRouter, Request, Depends, HTTPException, Form, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import User, UserSettings
from ..auth import (
    verify_password, 
    hash_password, 
    create_access_token, 
    decode_token,
    hash_security_answer,
    verify_security_answer
)

router = APIRouter(prefix="/auth", tags=["auth"])
templates = Jinja2Templates(directory="templates")

SECURITY_QUESTIONS = [
    "Qual o nome do seu primeiro animal de estimação?",
    "Qual o nome da sua primeira escola?",
    "Qual o nome da cidade onde você nasceu?",
    "Qual o nome do seu melhor amigo de infância?",
    "Qual o modelo do seu primeiro carro?",
]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Obtém o usuário atual baseado no cookie de sessão"""
    token = request.cookies.get("session_token")
    if not token:
        return None
    
    payload = decode_token(token)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    return user


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Página de login"""
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "login",
        "security_questions": SECURITY_QUESTIONS
    })


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Página de cadastro"""
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "register",
        "security_questions": SECURITY_QUESTIONS
    })


@router.get("/forgot", response_class=HTMLResponse)
async def forgot_page(request: Request):
    """Página de recuperação de senha"""
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "forgot",
        "security_questions": SECURITY_QUESTIONS
    })


@router.post("/login")
async def login(
    response: Response,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Processa login"""
    user = db.query(User).filter(User.username == username.lower().strip()).first()
    
    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse("auth.html", {
            "request": Request,
            "mode": "login",
            "error": "Usuário ou senha incorretos",
            "security_questions": SECURITY_QUESTIONS
        })
    
    # Criar token de sessão
    token = create_access_token({"sub": user.id})
    
    # Redirecionar com cookie
    redirect = RedirectResponse(url="/", status_code=303)
    redirect.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,  # 30 dias
        samesite="lax"
    )
    return redirect


@router.post("/register")
async def register(
    request: Request,
    response: Response,
    username: str = Form(...),
    password: str = Form(...),
    security_question: str = Form(...),
    security_answer: str = Form(...),
    db: Session = Depends(get_db)
):
    """Processa cadastro"""
    # Verificar se usuário já existe
    existing = db.query(User).filter(User.username == username.lower().strip()).first()
    if existing:
        return templates.TemplateResponse("auth.html", {
            "request": request,
            "mode": "register",
            "error": "Nome de usuário já existe",
            "security_questions": SECURITY_QUESTIONS
        })
    
    # Criar novo usuário
    user = User(
        username=username.lower().strip(),
        password_hash=hash_password(password),
        security_question=security_question,
        security_answer_hash=hash_security_answer(security_answer)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Criar configurações padrão
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    db.commit()
    
    # Criar token e redirecionar
    token = create_access_token({"sub": user.id})
    redirect = RedirectResponse(url="/", status_code=303)
    redirect.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax"
    )
    return redirect


@router.post("/forgot/check")
async def check_user(
    request: Request,
    username: str = Form(...),
    db: Session = Depends(get_db)
):
    """Verifica usuário e retorna pergunta de segurança"""
    user = db.query(User).filter(User.username == username.lower().strip()).first()
    
    if not user:
        return templates.TemplateResponse("auth.html", {
            "request": request,
            "mode": "forgot",
            "error": "Usuário não encontrado",
            "security_questions": SECURITY_QUESTIONS
        })
    
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "forgot_answer",
        "username": username,
        "security_question": user.security_question,
        "security_questions": SECURITY_QUESTIONS
    })


@router.post("/forgot/verify")
async def verify_answer(
    request: Request,
    username: str = Form(...),
    security_answer: str = Form(...),
    db: Session = Depends(get_db)
):
    """Verifica resposta de segurança"""
    user = db.query(User).filter(User.username == username.lower().strip()).first()
    
    if not user or not verify_security_answer(security_answer, user.security_answer_hash):
        return templates.TemplateResponse("auth.html", {
            "request": request,
            "mode": "forgot_answer",
            "username": username,
            "security_question": user.security_question if user else "",
            "error": "Resposta incorreta",
            "security_questions": SECURITY_QUESTIONS
        })
    
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "reset",
        "username": username,
        "security_questions": SECURITY_QUESTIONS
    })


@router.post("/forgot/reset")
async def reset_password(
    request: Request,
    username: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Redefine a senha"""
    user = db.query(User).filter(User.username == username.lower().strip()).first()
    
    if not user:
        return RedirectResponse(url="/auth/login", status_code=303)
    
    user.password_hash = hash_password(new_password)
    db.commit()
    
    return templates.TemplateResponse("auth.html", {
        "request": request,
        "mode": "login",
        "success": "Senha alterada com sucesso! Faça login.",
        "security_questions": SECURITY_QUESTIONS
    })


@router.get("/logout")
async def logout():
    """Faz logout"""
    redirect = RedirectResponse(url="/auth/login", status_code=303)
    redirect.delete_cookie("session_token")
    return redirect
