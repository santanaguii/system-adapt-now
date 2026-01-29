from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Criar pasta data se não existir
os.makedirs("data", exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Cria todas as tabelas no banco de dados"""
    from . import models  # Import models to register them
    Base.metadata.create_all(bind=engine)
