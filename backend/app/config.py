from dotenv import load_dotenv
load_dotenv()

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any

# Dev-time origins always included as a safe fallback.
# These are never stripped — even when CORS_ORIGINS is overridden in production.
_DEV_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# Placeholder value used in .env.example — treated as "not set"
_SECRET_KEY_PLACEHOLDER = "CHANGE_ME_generate_with_secrets_token_hex_32"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finance Pro API"
    DATABASE_URL: str = "sqlite:///./money_manager.db"

    # -------------------------------------------------------------------------
    # SECRET_KEY  (Required — no default)
    # -------------------------------------------------------------------------
    # Used to sign and verify all JWT access tokens.
    # Must be set via the SECRET_KEY environment variable (or in .env for local dev).
    # The app will refuse to start if this is missing, blank, or set to the
    # placeholder value from .env.example.
    #
    # Generate a secure value with:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    # -------------------------------------------------------------------------
    SECRET_KEY: str  # no default — intentionally required

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, value: Any) -> str:
        """
        Reject the app at startup if SECRET_KEY is:
          - missing / not set (Pydantic raises before this validator for truly absent fields)
          - an empty string or whitespace-only string
          - the literal placeholder from .env.example
          - shorter than 32 characters (too weak for HS256)
        """
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                "\n\n"
                "  SECRET_KEY is not set.\n"
                "  Add it to your .env file (local dev) or Render environment variables (production).\n"
                "  Generate a secure value with:\n"
                "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            )

        stripped = value.strip()

        if stripped == _SECRET_KEY_PLACEHOLDER:
            raise ValueError(
                "\n\n"
                "  SECRET_KEY is still set to the placeholder value from .env.example.\n"
                "  Replace it with a real secret before starting the server.\n"
                "  Generate a secure value with:\n"
                "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            )

        if len(stripped) < 32:
            raise ValueError(
                "\n\n"
                f"  SECRET_KEY is too short ({len(stripped)} chars). Minimum is 32 characters.\n"
                "  Generate a secure value with:\n"
                "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            )

        return stripped

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # -------------------------------------------------------------------------
    # CORS_ORIGINS
    # -------------------------------------------------------------------------
    # Accepts two formats via the CORS_ORIGINS environment variable:
    #
    #   Format 1 — JSON array (Pydantic native):
    #     CORS_ORIGINS=["https://finance-pro.onrender.com","https://myapp.vercel.app"]
    #
    #   Format 2 — Comma-separated plain string (simpler to type in dashboards):
    #     CORS_ORIGINS=https://finance-pro.onrender.com,https://myapp.vercel.app
    #
    # If the variable is not set, only the localhost dev origins are allowed.
    # -------------------------------------------------------------------------
    CORS_ORIGINS: List[str] = _DEV_ORIGINS

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> List[str]:
        """
        Normalise CORS_ORIGINS to a list regardless of how it was supplied:
        - Already a list (e.g. default or programmatic) → pass through.
        - JSON string (e.g. '["https://foo.com"]') → Pydantic handles it
          before this validator runs (mode='before' still receives the str).
        - Comma-separated string (e.g. 'https://a.com,https://b.com') → split.
        - Single URL string (e.g. 'https://a.com') → wrap in list.
        The localhost dev origins are always merged in so local dev always works.
        """
        if isinstance(value, list):
            parsed = [str(o).strip() for o in value if str(o).strip()]
        elif isinstance(value, str):
            stripped = value.strip()
            # Detect JSON array format
            if stripped.startswith("["):
                import json
                try:
                    parsed = [str(o).strip() for o in json.loads(stripped) if str(o).strip()]
                except json.JSONDecodeError:
                    parsed = [stripped]
            else:
                # Comma-separated or single URL
                parsed = [o.strip() for o in stripped.split(",") if o.strip()]
        else:
            parsed = _DEV_ORIGINS

        # Always include localhost dev origins so local dev never breaks
        merged = list(dict.fromkeys(_DEV_ORIGINS + parsed))  # deduplicated, order-preserved
        return merged

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

