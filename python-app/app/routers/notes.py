from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
import uuid

from ..database import get_db
from ..models import User, Note, NoteLine
from .auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["notes"])


class LineUpdate(BaseModel):
    content: Optional[str] = None
    type: Optional[str] = None
    collapsed: Optional[bool] = None
    indent: Optional[int] = None
    order: Optional[int] = None


class LineCreate(BaseModel):
    content: str = ""
    type: str = "paragraph"
    collapsed: bool = False
    indent: int = 0
    order: int = 0


class NoteResponse(BaseModel):
    date: str
    lines: list
    updated_at: str


def require_auth(request: Request, db: Session = Depends(get_db)) -> User:
    """Middleware que requer autenticação"""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


@router.get("/dates")
async def get_all_dates(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna todas as datas com notas"""
    notes = db.query(Note).filter(Note.user_id == user.id).all()
    dates = [note.date for note in notes]
    return JSONResponse(content={"dates": sorted(dates, reverse=True)})


@router.get("/{date}")
async def get_note(
    date: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Retorna nota de uma data específica"""
    note = db.query(Note).filter(
        Note.user_id == user.id,
        Note.date == date
    ).first()
    
    if not note:
        # Retorna nota vazia com uma linha padrão
        return JSONResponse(content={
            "date": date,
            "lines": [{
                "id": str(uuid.uuid4()),
                "content": "",
                "type": "paragraph",
                "collapsed": False,
                "indent": 0,
                "order": 0
            }],
            "updated_at": datetime.utcnow().isoformat()
        })
    
    lines = [{
        "id": line.id,
        "content": line.content,
        "type": line.type,
        "collapsed": line.collapsed,
        "indent": line.indent,
        "order": line.order
    } for line in sorted(note.lines, key=lambda x: x.order)]
    
    return JSONResponse(content={
        "date": note.date,
        "lines": lines,
        "updated_at": note.updated_at.isoformat()
    })


@router.put("/{date}")
async def save_note(
    date: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Salva nota completa"""
    data = await request.json()
    lines_data = data.get("lines", [])
    
    # Buscar ou criar nota
    note = db.query(Note).filter(
        Note.user_id == user.id,
        Note.date == date
    ).first()
    
    if not note:
        note = Note(user_id=user.id, date=date)
        db.add(note)
        db.commit()
        db.refresh(note)
    
    # Remover linhas existentes
    db.query(NoteLine).filter(NoteLine.note_id == note.id).delete()
    
    # Adicionar novas linhas
    for i, line_data in enumerate(lines_data):
        line = NoteLine(
            id=line_data.get("id", str(uuid.uuid4())),
            note_id=note.id,
            content=line_data.get("content", ""),
            type=line_data.get("type", "paragraph"),
            collapsed=line_data.get("collapsed", False),
            indent=line_data.get("indent", 0),
            order=i
        )
        db.add(line)
    
    note.updated_at = datetime.utcnow()
    db.commit()
    
    return JSONResponse(content={"success": True})


@router.post("/{date}/lines")
async def add_line(
    date: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Adiciona nova linha"""
    data = await request.json()
    after_line_id = data.get("afterLineId")
    line_type = data.get("type", "paragraph")
    
    # Buscar ou criar nota
    note = db.query(Note).filter(
        Note.user_id == user.id,
        Note.date == date
    ).first()
    
    if not note:
        note = Note(user_id=user.id, date=date)
        db.add(note)
        db.commit()
        db.refresh(note)
    
    # Calcular ordem
    if after_line_id:
        after_line = db.query(NoteLine).filter(NoteLine.id == after_line_id).first()
        new_order = after_line.order + 1 if after_line else 0
        
        # Incrementar ordem das linhas seguintes
        db.query(NoteLine).filter(
            NoteLine.note_id == note.id,
            NoteLine.order >= new_order
        ).update({NoteLine.order: NoteLine.order + 1})
    else:
        max_order = db.query(NoteLine).filter(NoteLine.note_id == note.id).count()
        new_order = max_order
    
    # Criar nova linha
    new_line = NoteLine(
        note_id=note.id,
        content="",
        type=line_type,
        order=new_order
    )
    db.add(new_line)
    db.commit()
    db.refresh(new_line)
    
    return JSONResponse(content={"id": new_line.id})


@router.patch("/{date}/lines/{line_id}")
async def update_line(
    date: str,
    line_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Atualiza linha existente"""
    data = await request.json()
    
    line = db.query(NoteLine).join(Note).filter(
        Note.user_id == user.id,
        NoteLine.id == line_id
    ).first()
    
    if not line:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    
    for key, value in data.items():
        if hasattr(line, key):
            setattr(line, key, value)
    
    db.commit()
    
    return JSONResponse(content={"success": True})


@router.delete("/{date}/lines/{line_id}")
async def delete_line(
    date: str,
    line_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Deleta linha"""
    line = db.query(NoteLine).join(Note).filter(
        Note.user_id == user.id,
        NoteLine.id == line_id
    ).first()
    
    if line:
        db.delete(line)
        db.commit()
    
    return JSONResponse(content={"success": True})


@router.get("/search/{query}")
async def search_notes(
    query: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth)
):
    """Pesquisa em todas as notas"""
    notes = db.query(Note).filter(Note.user_id == user.id).all()
    results = []
    
    query_lower = query.lower()
    
    for note in notes:
        matching_lines = [
            line for line in note.lines 
            if query_lower in line.content.lower()
        ]
        if matching_lines:
            results.append({
                "date": note.date,
                "lines": [{
                    "id": line.id,
                    "content": line.content,
                    "type": line.type
                } for line in matching_lines[:3]]  # Limit preview
            })
    
    return JSONResponse(content={"results": results})
