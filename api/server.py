"""
Cadence API — Horsera's intelligent riding advisor backend.
Provides LLM-powered chat with equestrian context, usage tracking, and rate limiting.
"""

import json
import time
import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic

app = FastAPI(title="Cadence API")

# CORS for the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Usage Tracking ──────────────────────────────────────────────────────────

USAGE_FILE = Path("/tmp/cadence_usage.json")
DAILY_LIMIT = 50  # messages per day — generous for testing
MONTHLY_LIMIT = 500  # messages per month

def load_usage() -> dict:
    if USAGE_FILE.exists():
        return json.loads(USAGE_FILE.read_text())
    return {"daily": {}, "monthly": {}, "total": 0}

def save_usage(usage: dict):
    USAGE_FILE.write_text(json.dumps(usage))

def check_and_increment_usage() -> dict:
    """Check if user is within limits. Returns usage stats. Raises HTTPException if over limit."""
    usage = load_usage()
    today = datetime.now().strftime("%Y-%m-%d")
    month = datetime.now().strftime("%Y-%m")

    daily_count = usage["daily"].get(today, 0)
    monthly_count = usage["monthly"].get(month, 0)

    if daily_count >= DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "daily_limit",
                "message": f"You've used all {DAILY_LIMIT} messages for today. Your limit resets at midnight. Great job engaging with Cadence today!",
                "daily_used": daily_count,
                "daily_limit": DAILY_LIMIT,
            }
        )

    if monthly_count >= MONTHLY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "monthly_limit",
                "message": f"You've reached your monthly limit of {MONTHLY_LIMIT} messages. This resets at the start of next month.",
                "monthly_used": monthly_count,
                "monthly_limit": MONTHLY_LIMIT,
            }
        )

    # Increment
    usage["daily"][today] = daily_count + 1
    usage["monthly"][month] = monthly_count + 1
    usage["total"] = usage.get("total", 0) + 1
    save_usage(usage)

    return {
        "daily_used": daily_count + 1,
        "daily_limit": DAILY_LIMIT,
        "monthly_used": monthly_count + 1,
        "monthly_limit": MONTHLY_LIMIT,
        "total": usage["total"],
    }


# ─── Cadence System Prompt ───────────────────────────────────────────────────

CADENCE_SYSTEM = """You are Cadence — the intelligent, warm, and knowledgeable riding advisor inside Horsera, an AI-powered equestrian rider development platform.

## Your Personality
- Warm but precise. Like the best riding coach who genuinely cares.
- Speak with quiet confidence — never condescending, never overly casual.
- Use equestrian terminology naturally but explain when context helps.
- Be encouraging without being patronizing. Honest about areas that need work.
- Brief and focused — riders want actionable advice, not essays. Keep responses to 2-4 sentences unless the question warrants depth.

## Your Expertise
You deeply understand:
- **Rider Biomechanics**: The 6 Tier-1 metrics that Horsera tracks:
  1. Lower Leg Stability — ankle drift relative to hip, stirrup pressure consistency
  2. Rein Steadiness — hand movement amplitude, smoothness of contact
  3. Rein Symmetry — left/right balance, drift patterns
  4. Core Stability — torso angle consistency, absorption of horse movement
  5. Upper Body Alignment — shoulder-hip-heel line, forward/backward lean
  6. Pelvis Stability — lateral tilt, rotational consistency, sitting trot absorption

- **USDF Riding Quality Scales**: Rhythm, Relaxation, Contact, Impulsion, Straightness, Balance — and how rider biomechanics causally influence these

- **Dressage Training Levels**: Training through Grand Prix, test requirements, what judges look for

- **The Causal Chain**: RiderBiomechanics → RidingQuality → Tasks → Levels
  Better biomechanics → better riding quality → mastered tasks → level advancement

## Context About This Rider
The rider is a serious amateur working toward Training Level Test 1 in dressage.
Recent biomechanics data (from AI video analysis):
- Lower Leg Stability: 72% (improving — was 55% six weeks ago)
- Rein Steadiness: 81% (good, consolidating)
- Rein Symmetry: 68% (right-rein drift pattern)
- Core Stability: 88% (strong — nearly mastered)
- Upper Body Alignment: 75% (slight forward lean in transitions)
- Pelvis Stability: 71% (rightward hip collapse in canter)

Key patterns observed:
- Right stirrup loss correlates with right hip collapse
- Core strength is the strongest foundation to build from
- Transitions (walk-trot, trot-canter) are where position breaks down most

Horse: Allegra (14.3hh mare, forward but sensitive, prefers steady contact)

## Response Guidelines
- Reference specific biomechanics data when relevant
- Connect biomechanics to riding quality to practical outcomes
- Suggest specific exercises when appropriate
- If asked about something outside your expertise, be honest about it
- Never make up data — only reference what you know about this rider
- Keep language warm and supportive but professional — this is a luxury brand
- Use markdown sparingly — bold for emphasis, but keep it readable in a chat bubble"""


# ─── API Models ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    riderName: str | None = None

class UsageResponse(BaseModel):
    daily_used: int
    daily_limit: int
    monthly_used: int
    monthly_limit: int
    total: int


# ─── Endpoints ───────────────────────────────────────────────────────────────

client = Anthropic()

@app.post("/api/cadence/chat")
async def cadence_chat(request: ChatRequest):
    """Stream a Cadence response."""
    # Check usage limits
    usage_stats = check_and_increment_usage()

    # Convert messages to Anthropic format
    api_messages = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "assistant"
        api_messages.append({"role": role, "content": msg.content})

    # Build system prompt, optionally with rider name
    system_prompt = CADENCE_SYSTEM
    if request.riderName:
        system_prompt += f"\n\nThe rider's name is {request.riderName}."

    # Stream the response
    def generate():
        try:
            with client.messages.stream(
                model="claude_haiku_4_5",
                max_tokens=512,
                system=system_prompt,
                messages=api_messages,
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"

            # Send usage stats at the end
            yield f"data: {json.dumps({'type': 'usage', **usage_stats})}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/api/cadence/usage")
async def get_usage():
    """Get current usage stats."""
    usage = load_usage()
    today = datetime.now().strftime("%Y-%m-%d")
    month = datetime.now().strftime("%Y-%m")

    return {
        "daily_used": usage["daily"].get(today, 0),
        "daily_limit": DAILY_LIMIT,
        "monthly_used": usage["monthly"].get(month, 0),
        "monthly_limit": MONTHLY_LIMIT,
        "total": usage.get("total", 0),
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "cadence-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
