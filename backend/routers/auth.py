import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
import jwt
import hashlib
import json
import base64

from config import ADMIN_PASSWORD, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY
from rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginRequest(BaseModel):
    email: Optional[str] = None
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_at: str
    role: str = "admin"


def create_token(data: dict) -> str:
    """Create JWT token using PyJWT. Uses RS256 if keys available, else HS256."""
    payload = {
        **data,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    key = JWT_PRIVATE_KEY if JWT_ALGORITHM == "RS256" else JWT_SECRET
    return jwt.encode(payload, key, algorithm=JWT_ALGORITHM)


def _verify_legacy_token(token: str) -> dict:
    """Verify old-format Base64+SHA256 tokens for backward compatibility."""
    parts = token.split(".")
    if len(parts) != 2:
        raise ValueError("Not a legacy token")
    payload_bytes = base64.urlsafe_b64decode(parts[0])
    payload = json.loads(payload_bytes)
    expected_sig = hashlib.sha256(f"{payload_bytes.decode()}{JWT_SECRET}".encode()).hexdigest()[:32]
    if parts[1] != expected_sig:
        raise ValueError("Invalid legacy signature")
    if datetime.fromisoformat(payload["exp"]) < datetime.now(timezone.utc).replace(tzinfo=None):
        raise ValueError("Legacy token expired")
    return payload


def verify_token(token: str) -> dict:
    """Verify JWT token. Tries PyJWT first, falls back to legacy format."""
    # Try PyJWT decode first
    try:
        key = JWT_PUBLIC_KEY if JWT_ALGORITHM == "RS256" else JWT_SECRET
        algorithms = [JWT_ALGORITHM]
        # Also accept HS256 tokens even if RS256 is configured (migration period)
        if JWT_ALGORITHM == "RS256":
            algorithms.append("HS256")
        payload = jwt.decode(token, key, algorithms=algorithms)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        pass  # Fall through to legacy check

    # Try legacy Base64+SHA256 format (backward compatibility)
    try:
        return _verify_legacy_token(token)
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(authorization: str = Header(default="")) -> dict:
    """Extract and verify JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization[7:]
    return verify_token(token)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, req: LoginRequest):
    # Legacy password-only login (backward compatible)
    if req.password == ADMIN_PASSWORD:
        token = create_token({"role": "admin", "user_id": 0})
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()
        logger.info("Admin login successful (legacy password)")
        return LoginResponse(token=token, expires_at=expires_at, role="admin")

    # If email provided, try User-based login (added in Section 2 RBAC)
    if req.email:
        try:
            from models import User
            from database import SessionLocal
            import bcrypt as bcrypt_lib
            db = SessionLocal()
            user = db.query(User).filter(User.email == req.email, User.is_active == True).first()
            if user and bcrypt_lib.checkpw(req.password.encode(), user.password_hash.encode()):
                token = create_token({
                    "role": user.role,
                    "user_id": user.id,
                    "school_id": user.school_id,
                })
                expires_at = (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()
                logger.info(f"User login: {user.email} (role={user.role})")
                db.close()
                return LoginResponse(token=token, expires_at=expires_at, role=user.role)
            db.close()
        except Exception:
            pass  # User model may not exist yet — fall through

    raise HTTPException(status_code=401, detail="Invalid credentials")


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "counsellor"  # admin, counsellor, school_admin
    school_id: Optional[int] = None


@router.post("/register", status_code=201)
def register(req: RegisterRequest, user: dict = Depends(get_current_user)):
    """Register a new user (admin-only)."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can register users")
    if req.role not in ("admin", "counsellor", "school_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    import bcrypt as bcrypt_lib
    from models import User
    from database import SessionLocal

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == req.email).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"User {req.email} already exists")
        password_hash = bcrypt_lib.hashpw(req.password.encode(), bcrypt_lib.gensalt()).decode()
        new_user = User(
            email=req.email,
            name=req.name,
            password_hash=password_hash,
            role=req.role,
            school_id=req.school_id,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"User registered: {req.email} (role={req.role})")
        return {"id": new_user.id, "email": new_user.email, "role": new_user.role, "name": new_user.name}
    finally:
        db.close()


@router.get("/users")
def list_users(user: dict = Depends(get_current_user)):
    """List all users (admin-only)."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from models import User
    from database import SessionLocal

    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id).all()
        return [
            {"id": u.id, "email": u.email, "name": u.name, "role": u.role,
             "school_id": u.school_id, "is_active": u.is_active}
            for u in users
        ]
    finally:
        db.close()


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "role": user.get("role", "admin"),
        "user_id": user.get("user_id", 0),
        "school_id": user.get("school_id"),
        "authenticated": True,
    }
