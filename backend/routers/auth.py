import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
import jwt
import secrets

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


def verify_token(token: str) -> dict:
    """Verify a JWT.

    The previous implementation fell back to a "legacy" format authenticated by
    sha256(payload + JWT_SECRET)[:32] — a truncated, non-HMAC construction that
    accepted any payload an attacker could construct, including role="admin".
    That path is deleted; only real JWT signatures are accepted.
    """
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
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()

    # Email login is checked FIRST and exclusively. Previously the shared-password
    # branch ran first regardless of whether an email was supplied, so a
    # school_admin whose password happened to equal ADMIN_PASSWORD was handed a
    # full admin token.
    if req.email:
        from database import SessionLocal
        from models import User
        import bcrypt as bcrypt_lib

        db = SessionLocal()
        try:
            user = (
                db.query(User)
                .filter(User.email == req.email, User.is_active == True)  # noqa: E712
                .first()
            )
            if user and bcrypt_lib.checkpw(req.password.encode(), user.password_hash.encode()):
                token = create_token({
                    "role": user.role,
                    "user_id": user.id,
                    "school_id": user.school_id,
                })
                logger.info(f"User login: {user.email} (role={user.role})")
                return LoginResponse(token=token, expires_at=expires_at, role=user.role)
        except HTTPException:
            raise
        except Exception:
            logger.exception("Email login failed")
        finally:
            # Previously only the success paths closed the session, so any
            # exception leaked a pooled connection.
            db.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Shared-password bootstrap login. config.py refuses to start in production
    # without ADMIN_PASSWORD, so there is no guessable default any more.
    if ADMIN_PASSWORD and secrets.compare_digest(req.password, ADMIN_PASSWORD):
        token = create_token({"role": "admin", "user_id": 0})
        logger.info("Admin login successful (shared password)")
        return LoginResponse(token=token, expires_at=expires_at, role="admin")

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
