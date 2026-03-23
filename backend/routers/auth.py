import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
import hashlib
import json
import base64

from config import ADMIN_PASSWORD, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_at: str


def create_token(data: dict) -> str:
    payload = {**data, "exp": (datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()}
    payload_bytes = json.dumps(payload).encode()
    signature = hashlib.sha256(f"{payload_bytes.decode()}{JWT_SECRET}".encode()).hexdigest()[:32]
    token_data = base64.urlsafe_b64encode(payload_bytes).decode()
    return f"{token_data}.{signature}"


def verify_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("Invalid token format")
        payload_bytes = base64.urlsafe_b64decode(parts[0])
        payload = json.loads(payload_bytes)
        expected_sig = hashlib.sha256(f"{payload_bytes.decode()}{JWT_SECRET}".encode()).hexdigest()[:32]
        if parts[1] != expected_sig:
            raise ValueError("Invalid signature")
        if datetime.fromisoformat(payload["exp"]) < datetime.utcnow():
            raise ValueError("Token expired")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(authorization: str = Header(default="")) -> dict:
    """Extract and verify JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization[7:]
    return verify_token(token)


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    if req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_token({"role": "admin"})
    expires_at = (datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()
    logger.info("Admin login successful")
    return LoginResponse(token=token, expires_at=expires_at)


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"role": user.get("role", "admin"), "authenticated": True}
