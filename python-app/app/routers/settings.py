from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import re

from ..database import get_db
from ..models import User, UserSettings, Tag, CustomField
from .auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


def require_auth(request: Request, db: Session = Depends(get_db)) -> User:
    """Middleware que requer autenticação"""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


def generate_key(name: str) -> str:
    """Gera chave a partir do nome"""
    # Remove acentos e caracteres especiais
    key = name.lower().strip()
    key = re.sub(r'[áàãâä]', 'a', key)
    key = re.sub(r'[éèêë]', 'e', key)
    key = re.sub(r'[íìîï]', 'i', key)
    key = re.sub(r'[óòõôö]', 'o', key)
    key = re.sub(r'[úùûü]', 'u', key)
    key = re.sub(r'[ç]', 'c', key)
    key = re.sub(r'[^a-z0-9\s]', '', key)
    key = re.sub(r'\s+', '_', key)
    return key


@router.get("")
async def get_settings(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna todas as configurações do usuário"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    tags = db.query(Tag).filter(Tag.user_id == user.id).all()
    custom_fields = db.query(CustomField).filter(CustomField.user_id == user.id).order_by(CustomField.order).all()
    
    return JSONResponse(content={
        "allowReopenCompleted": settings.allow_reopen_completed if settings else True,
        "defaultSort": settings.default_sort if settings else "manual",
        "activityCreationMode": settings.activity_creation_mode if settings else "simple",
        "tags": [{
            "id": t.id,
            "name": t.name,
            "color": t.color
        } for t in tags],
        "customFields": [{
            "id": f.id,
            "key": f.key,
            "name": f.name,
            "type": f.type,
            "options": f.options_json or [],
            "enabled": f.enabled,
            "required": f.required,
            "defaultValue": f.default_value,
            "display": f.display,
            "order": f.order
        } for f in custom_fields]
    })


@router.patch("")
async def update_settings(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Atualiza configurações gerais"""
    data = await request.json()
    
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
    
    if "allowReopenCompleted" in data:
        settings.allow_reopen_completed = data["allowReopenCompleted"]
    if "defaultSort" in data:
        settings.default_sort = data["defaultSort"]
    if "activityCreationMode" in data:
        settings.activity_creation_mode = data["activityCreationMode"]
    
    db.commit()
    
    return JSONResponse(content={"success": True})


# ========== Tags ==========

@router.get("/tags")
async def get_tags(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna todas as tags"""
    tags = db.query(Tag).filter(Tag.user_id == user.id).all()
    return JSONResponse(content={
        "tags": [{
            "id": t.id,
            "name": t.name,
            "color": t.color
        } for t in tags]
    })


@router.post("/tags")
async def create_tag(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Cria nova tag"""
    data = await request.json()
    
    tag = Tag(
        user_id=user.id,
        name=data.get("name", "Nova Tag"),
        color=data.get("color", "#f59e0b")
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    
    return JSONResponse(content={
        "id": tag.id,
        "name": tag.name,
        "color": tag.color
    })


@router.patch("/tags/{tag_id}")
async def update_tag(
    tag_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Atualiza tag"""
    data = await request.json()
    
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == user.id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag não encontrada")
    
    if "name" in data:
        tag.name = data["name"]
    if "color" in data:
        tag.color = data["color"]
    
    db.commit()
    
    return JSONResponse(content={"success": True})


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Deleta tag"""
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == user.id).first()
    if tag:
        db.delete(tag)
        db.commit()
    
    return JSONResponse(content={"success": True})


# ========== Custom Fields ==========

@router.get("/fields")
async def get_custom_fields(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna todos os campos customizados"""
    fields = db.query(CustomField).filter(
        CustomField.user_id == user.id
    ).order_by(CustomField.order).all()
    
    return JSONResponse(content={
        "fields": [{
            "id": f.id,
            "key": f.key,
            "name": f.name,
            "type": f.type,
            "options": f.options_json or [],
            "enabled": f.enabled,
            "required": f.required,
            "defaultValue": f.default_value,
            "display": f.display,
            "order": f.order
        } for f in fields]
    })


@router.post("/fields")
async def create_custom_field(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Cria novo campo customizado"""
    data = await request.json()
    
    name = data.get("name", "Novo Campo")
    key = generate_key(name)
    
    # Garantir key única
    existing = db.query(CustomField).filter(
        CustomField.user_id == user.id,
        CustomField.key == key
    ).first()
    if existing:
        key = f"{key}_{str(uuid.uuid4())[:8]}"
    
    max_order = db.query(CustomField).filter(
        CustomField.user_id == user.id
    ).count()
    
    field = CustomField(
        user_id=user.id,
        key=key,
        name=name,
        type=data.get("type", "text"),
        options_json=data.get("options", []),
        enabled=data.get("enabled", True),
        required=data.get("required", False),
        default_value=data.get("defaultValue"),
        display=data.get("display", "both"),
        order=max_order
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    
    return JSONResponse(content={
        "id": field.id,
        "key": field.key,
        "name": field.name,
        "type": field.type,
        "options": field.options_json,
        "enabled": field.enabled,
        "required": field.required,
        "defaultValue": field.default_value,
        "display": field.display,
        "order": field.order
    })


@router.patch("/fields/{field_id}")
async def update_custom_field(
    field_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Atualiza campo customizado"""
    data = await request.json()
    
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.user_id == user.id
    ).first()
    
    if not field:
        raise HTTPException(status_code=404, detail="Campo não encontrado")
    
    if "name" in data:
        field.name = data["name"]
    if "type" in data:
        field.type = data["type"]
    if "options" in data:
        field.options_json = data["options"]
    if "enabled" in data:
        field.enabled = data["enabled"]
    if "required" in data:
        field.required = data["required"]
    if "defaultValue" in data:
        field.default_value = data["defaultValue"]
    if "display" in data:
        field.display = data["display"]
    if "order" in data:
        field.order = data["order"]
    
    db.commit()
    
    return JSONResponse(content={"success": True})


@router.delete("/fields/{field_id}")
async def delete_custom_field(
    field_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Deleta campo customizado"""
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.user_id == user.id
    ).first()
    if field:
        db.delete(field)
        db.commit()
    
    return JSONResponse(content={"success": True})
