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

class Settings(BaseSettings):
    PROJECT_NAME: str = "Finance Pro API"
    DATABASE_URL: str = "sqlite:///./money_manager.db"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
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
