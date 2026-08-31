"""Authentication must reject the credentials this codebase used to accept.

Guards two verified flaws: verify_token fell back to a "legacy" format
authenticated by sha256(payload + JWT_SECRET)[:32] — truncated, not an HMAC —
so any payload an attacker constructed was accepted, including role="admin";
and JWT_SECRET itself defaulted to a literal published in config.py.
"""

import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest

# The value that shipped in config.py as the default.
PUBLISHED_SECRET = "careerneeti-secret-change-in-production"


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Login is rate-limited; without a reset one test starves the next."""
    from rate_limit import limiter

    limiter.reset()
    yield
    limiter.reset()


class TestTokenForgery:
    def test_token_signed_with_the_published_secret_is_rejected(self, client):
        import jwt

        forged = jwt.encode(
            {"role": "admin", "user_id": 0,
             "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            PUBLISHED_SECRET, algorithm="HS256",
        )
        r = client.get("/api/schools", headers={"Authorization": f"Bearer {forged}"})
        assert r.status_code == 401

    def test_legacy_base64_signature_format_is_rejected(self, client):
        """The non-HMAC fallback: sha256(payload + secret)[:32].

        Forged with the app's REAL current secret on purpose. Signing with the
        old published constant would be rejected merely because the secret is
        wrong, so the test would pass even with the fallback restored — it has to
        be a token the fallback would genuinely have accepted.
        """
        from config import JWT_SECRET

        payload = json.dumps({
            "role": "admin", "user_id": 0,
            "exp": (datetime.now(timezone.utc) + timedelta(hours=1))
                   .replace(tzinfo=None).isoformat(),
        })
        encoded = base64.urlsafe_b64encode(payload.encode()).decode()
        sig = hashlib.sha256(f"{payload}{JWT_SECRET}".encode()).hexdigest()[:32]
        r = client.get("/api/schools",
                       headers={"Authorization": f"Bearer {encoded}.{sig}"})
        assert r.status_code == 401

    def test_garbage_token_is_rejected(self, client):
        r = client.get("/api/schools", headers={"Authorization": "Bearer not.a.token"})
        assert r.status_code == 401

    def test_missing_header_is_rejected(self, client):
        assert client.get("/api/schools").status_code == 401


class TestLogin:
    def test_shared_password_grants_admin(self, client):
        from config import ADMIN_PASSWORD

        r = client.post("/api/auth/login", json={"password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "admin"

    def test_wrong_password_is_401_not_500(self, client):
        r = client.post("/api/auth/login", json={"password": "definitely-wrong"})
        assert r.status_code == 401

    def test_supplying_an_email_never_falls_back_to_the_shared_password(self, client, db):
        """A school_admin whose password equalled ADMIN_PASSWORD used to receive
        an admin token, because the shared-password branch ran first and ignored
        whether an email was given."""
        import bcrypt
        from config import ADMIN_PASSWORD
        from models import User

        db.add(User(
            email="school.admin@example.com", name="School Admin",
            password_hash=bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            role="school_admin", is_active=True,
        ))
        db.commit()

        r = client.post("/api/auth/login",
                        json={"email": "school.admin@example.com",
                              "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "school_admin", "email login escalated to admin"

    def test_unknown_email_does_not_fall_through_to_shared_password(self, client):
        from config import ADMIN_PASSWORD

        r = client.post("/api/auth/login",
                        json={"email": "nobody@example.com", "password": ADMIN_PASSWORD})
        assert r.status_code == 401

    def test_inactive_user_cannot_log_in(self, client, db):
        import bcrypt
        from models import User

        db.add(User(
            email="gone@example.com", name="Gone",
            password_hash=bcrypt.hashpw(b"pw123456", bcrypt.gensalt()).decode(),
            role="counsellor", is_active=False,
        ))
        db.commit()
        r = client.post("/api/auth/login",
                        json={"email": "gone@example.com", "password": "pw123456"})
        assert r.status_code == 401


class TestRoleEnforcement:
    def test_demotion_takes_effect_before_the_token_expires(self, client, db, two_schools):
        """access.require_role re-reads the role from the database each request.

        permissions.require_role trusted the claim baked into a 24-hour token, so
        a demoted admin kept admin rights until it expired.
        """
        from models import User
        from routers.auth import create_token

        user = User(email="temp.admin@example.com", name="Temp Admin",
                    password_hash="x", role="admin", is_active=True)
        db.add(user)
        db.commit()

        token = create_token({"role": "admin", "user_id": user.id})
        headers = {"Authorization": f"Bearer {token}"}

        assert client.post("/api/schools",
                           json={"name": "Made By Admin", "code": "MBA", "city": "X"},
                           headers=headers).status_code == 201

        # Same token, role revoked in the database.
        user.role = "counsellor"
        db.commit()

        r = client.post("/api/schools",
                        json={"name": "After Demotion", "code": "AD", "city": "X"},
                        headers=headers)
        assert r.status_code == 403, "a demoted admin still had admin rights"
