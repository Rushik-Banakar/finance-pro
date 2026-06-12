import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import engine, Base
from .routers import (
    auth, accounts, transactions, categories, analytics, support, 
    settings as user_settings, coach
)

# Bind SQLAlchemy models
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade, full-stack, data-driven personal finance management & expense analytics platform.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Global Exception Handler for robustness
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "detail": f"Internal Server Error: {str(exc)}"}
    )

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(user_settings.router, prefix="/api")
app.include_router(coach.router, prefix="/api")

@app.get("/")
def root_check():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "documentation": "/docs"
    }

@app.on_event("startup")
def startup_event():
    print("ENVIRONMENT CHECK", flush=True)
    print(f"GROQ_API_KEY: {'FOUND' if os.environ.get('GROQ_API_KEY') else 'NOT FOUND'}", flush=True)
    print(f"OPENAI_API_KEY: {'FOUND' if os.environ.get('OPENAI_API_KEY') else 'NOT FOUND'}", flush=True)
    print(f"GEMINI_API_KEY: {'FOUND' if os.environ.get('GEMINI_API_KEY') else 'NOT FOUND'}", flush=True)
    print(f"ANTHROPIC_API_KEY: {'FOUND' if os.environ.get('ANTHROPIC_API_KEY') else 'NOT FOUND'}", flush=True)
    print(f"GROQ key detected: {'TRUE' if os.environ.get('GROQ_API_KEY') else 'FALSE'}", flush=True)
    print(f"OpenAI key detected: {'TRUE' if os.environ.get('OPENAI_API_KEY') else 'FALSE'}", flush=True)
    print(f"Gemini key detected: {'TRUE' if os.environ.get('GEMINI_API_KEY') else 'FALSE'}", flush=True)
    print(f"Anthropic key detected: {'TRUE' if os.environ.get('ANTHROPIC_API_KEY') else 'FALSE'}", flush=True)
    print(f"CORS_ORIGINS: {settings.CORS_ORIGINS}", flush=True)
    print(f"SECRET_KEY: SET (starts with '{settings.SECRET_KEY[:8]}...')", flush=True)


@app.get("/api/debug/llm-status")
def get_llm_status():
    return {
        "groq_key_found": bool(os.environ.get("GROQ_API_KEY")),
        "openai_key_found": bool(os.environ.get("OPENAI_API_KEY")),
        "gemini_key_found": bool(os.environ.get("GEMINI_API_KEY")),
        "anthropic_key_found": bool(os.environ.get("ANTHROPIC_API_KEY"))
    }


