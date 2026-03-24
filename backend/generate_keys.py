#!/usr/bin/env python3
"""Generate RSA key pair for JWT RS256 signing.

Run once: python generate_keys.py
Output: backend/keys/private.pem, backend/keys/public.pem
"""

from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

KEYS_DIR = Path(__file__).parent / "keys"


def generate():
    KEYS_DIR.mkdir(exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Write private key
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    (KEYS_DIR / "private.pem").write_bytes(private_pem)

    # Write public key
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    (KEYS_DIR / "public.pem").write_bytes(public_pem)

    print(f"RSA key pair generated in {KEYS_DIR}/")
    print(f"Add to .env:")
    print(f"  JWT_PRIVATE_KEY_PATH={KEYS_DIR / 'private.pem'}")
    print(f"  JWT_PUBLIC_KEY_PATH={KEYS_DIR / 'public.pem'}")


if __name__ == "__main__":
    generate()
