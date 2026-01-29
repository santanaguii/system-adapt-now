from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import os

from .database import get_db, init_db
from .routers import auth, notes, activities, settings
from .routers.auth import get_current_user

# Criar pasta static se não existir
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

app = FastAPI(title="Meu Sistema - Notas e Atividades")

# Montar arquivos estáticos
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Incluir routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(activities.router)
app.include_router(settings.router)


@app.on_event("startup")
async def startup():
    """Inicializa o banco de dados"""
    init_db()


@app.get("/")
async def index(request: Request, db: Session = Depends(get_db)):
    """Página principal"""
    user = get_current_user(request, db)
    
    if not user:
        return RedirectResponse(url="/auth/login", status_code=303)
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "user": user
    })


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "ok"}
