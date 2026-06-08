from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict

from ..database import get_db
from ..models.auth import User
from .auth import get_current_user
from ..services.coach_service import CoachService
from ..services.llm_service import LLMService
from ..services.financial_context_builder import FinancialContextBuilder

router = APIRouter(prefix="/coach", tags=["coach"])

class ChatMessageIn(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

@router.get("/insights")
def get_advisor_insights(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        service = CoachService(db, user.id)
        insights = service.get_insights_dashboard()
        return insights
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate advisor insights: {str(e)}"
        )

@router.post("/chat")
def get_advisor_reply(
    payload: ChatMessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        service = CoachService(db, user.id)

        # ── Build rich financial context from real DB data ────────────────
        context = FinancialContextBuilder(service).build()

        # ── Classify intent and route to agent ───────────────────────────
        intent = service.classify_intent(payload.message.lower().strip())

        agent_mapping = {
            "cfo_review":          "cfo",
            "health_score":        "health",
            "spending_risks":      "health",
            "savings_optimization":"savings",
            "salary_increase":     "master",
            "goal_acceleration":   "savings",
            "spending_habit":      "budget",
            "lifestyle_inflation": "health",
            "emergency_fund":      "savings",
            "affordability":       "affordability",
        }
        agent_type = agent_mapping.get(intent, "master")

        print(f"[COACH] Intent={intent} → Agent={agent_type}", flush=True)

        # ── Call LLM ──────────────────────────────────────────────────────
        llm   = LLMService(context=context, history=payload.history)
        reply = llm.generate_response(payload.message, agent_type)

        return {"reply": reply}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat: {str(e)}"
        )

