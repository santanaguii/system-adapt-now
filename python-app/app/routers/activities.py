from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ..database import get_db
from ..models import User, Activity
from .auth import get_current_user

router = APIRouter(prefix="/api/activities", tags=["activities"])


def require_auth(request: Request, db: Session = Depends(get_db)) -> User:
    """Middleware que requer autenticação"""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


@router.get("")
async def get_activities(
    request: Request,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna todas as atividades do usuário"""
    query = db.query(Activity).filter(Activity.user_id == user.id)
    
    if status:
        query = query.filter(Activity.status == status)
    
    activities = query.order_by(Activity.order).all()
    
    # Filtrar por tag se especificado
    if tag:
        activities = [a for a in activities if tag in (a.tags_json or [])]
    
    result = [{
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "status": a.status,
        "completed": a.completed,
        "tags": a.tags_json or [],
        "customFields": a.custom_fields_json or {},
        "order": a.order,
        "createdAt": a.created_at.isoformat(),
        "updatedAt": a.updated_at.isoformat(),
        "completedAt": a.completed_at.isoformat() if a.completed_at else None
    } for a in activities]
    
    return JSONResponse(content={"activities": result})


@router.post("")
async def create_activity(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Cria nova atividade"""
    data = await request.json()
    
    # Calcular próxima ordem
    max_order = db.query(Activity).filter(
        Activity.user_id == user.id
    ).count()
    
    activity = Activity(
        user_id=user.id,
        title=data.get("title", ""),
        description=data.get("description", ""),
        status="open",
        completed=False,
        tags_json=data.get("tags", []),
        custom_fields_json=data.get("customFields", {}),
        order=max_order
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    
    return JSONResponse(content={
        "id": activity.id,
        "title": activity.title,
        "description": activity.description,
        "status": activity.status,
        "completed": activity.completed,
        "tags": activity.tags_json,
        "customFields": activity.custom_fields_json,
        "order": activity.order,
        "createdAt": activity.created_at.isoformat(),
        "updatedAt": activity.updated_at.isoformat()
    })


@router.patch("/{activity_id}")
async def update_activity(
    activity_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Atualiza atividade"""
    data = await request.json()
    
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == user.id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    
    # Atualizar campos
    if "title" in data:
        activity.title = data["title"]
    if "description" in data:
        activity.description = data["description"]
    if "tags" in data:
        activity.tags_json = data["tags"]
    if "customFields" in data:
        activity.custom_fields_json = data["customFields"]
    if "order" in data:
        activity.order = data["order"]
    
    # Marcar como concluído
    if "completed" in data:
        activity.completed = data["completed"]
        if data["completed"]:
            activity.status = "done"
            activity.completed_at = datetime.utcnow()
        else:
            activity.status = "open"
            activity.completed_at = None
    
    activity.updated_at = datetime.utcnow()
    db.commit()
    
    return JSONResponse(content={"success": True})


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Deleta atividade"""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.user_id == user.id
    ).first()
    
    if activity:
        db.delete(activity)
        db.commit()
    
    return JSONResponse(content={"success": True})


@router.post("/reorder")
async def reorder_activities(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Reordena atividades"""
    data = await request.json()
    order_map = data.get("order", {})  # {activity_id: new_order}
    
    for activity_id, new_order in order_map.items():
        db.query(Activity).filter(
            Activity.id == activity_id,
            Activity.user_id == user.id
        ).update({Activity.order: new_order})
    
    db.commit()
    
    return JSONResponse(content={"success": True})
