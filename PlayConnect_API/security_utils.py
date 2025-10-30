"""Security utilities for PlayConnect API.

This module centralizes password and token utilities so that the rest of the
app (main.py, services, routes) never deals with raw passwords directly.

We use passlib's CryptContext with bcrypt — same class of hashing Supabase uses
internally — so this is safe for production-level password storage.
"""

import hashlib
import secrets
from passlib.context import CryptContext

# bcrypt is what we want. "auto" lets us upgrade later if needed.
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Token helpers (you were already doing this)
# ---------------------------------------------------------------------------

def gen_reset_token() -> str:
    """Generate a secure, URL-safe token for password reset links."""
    return secrets.token_urlsafe(32)


def hash_token(raw: str) -> str:
    """Return a stable SHA-256 hash of the token to store in DB."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Password helpers (this is what we'll use in main.py)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Usage:
        hashed = hash_password("mysecret")
        # store `hashed` in DB, NOT the plaintext
    """
    return pwd_ctx.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify that `plain_password` matches the stored `password_hash`."""
    return pwd_ctx.verify(plain_password, password_hash)


# ---------------------------------------------------------------------------
# (Optional) helper for migrations from old plaintext column
# ---------------------------------------------------------------------------

def needs_rehash(password_hash: str) -> bool:
    """Return True if this hash was generated with old params and needs update.

    This lets us do:
        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(plain)
    """
    return pwd_ctx.needs_update(password_hash)
