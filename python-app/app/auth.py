from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import secrets

# Configuração de segurança
SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha plain corresponde ao hash"""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Cria hash da senha"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decodifica e valida token JWT"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_security_answer(plain_answer: str, hashed_answer: str) -> bool:
    """Verifica se a resposta de segurança corresponde"""
    # Normaliza a resposta (lowercase, trim)
    normalized = plain_answer.lower().strip()
    return pwd_context.verify(normalized, hashed_answer)


def hash_security_answer(answer: str) -> str:
    """Cria hash da resposta de segurança"""
    normalized = answer.lower().strip()
    return pwd_context.hash(normalized)
