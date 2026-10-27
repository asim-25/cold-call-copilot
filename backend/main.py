import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv
import google.generativeai as genai

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = FastAPI(title="Cold Call Co-Pilot API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CallCreate(BaseModel):
    prospect_name: str
    company: str

class StageCreate(BaseModel):
    stage_number: int = Field(..., ge=1, le=8)
    button_tapped: str | None = None
    prospect_words: str | None = None

class CallClose(BaseModel):
    outcome: str | None = None

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/calls", status_code=status.HTTP_201_CREATED)
def start_call(payload: CallCreate):
    res = supabase.table("calls").insert({
        "prospect_name": payload.prospect_name,
        "company": payload.company
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create call session")
    return res.data[0]

@app.post("/calls/{call_id}/stages", status_code=status.HTTP_201_CREATED)
def log_stage(call_id: str, payload: StageCreate):
    call_check = supabase.table("calls").select("id").eq("id", call_id).execute()
    if not call_check.data:
        raise HTTPException(status_code=404, detail="Call session not found")
    
    res = supabase.table("call_stages").insert({
        "call_id": call_id,
        "stage_number": payload.stage_number,
        "button_targget": payload.button_tapped,
        "prospect_words": payload.prospect_words
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log stage")
    return res.data[0]

@app.put("/calls/{call_id}")
def close_call(call_id: str, payload: CallClose = CallClose()):
    call_check = supabase.table("calls").select("id").eq("id", call_id).execute()
    if not call_check.data:
        raise HTTPException(status_code=404, detail="Call session not found")
    
    outcome = payload.outcome
    if not outcome:
        stages_res = supabase.table("call_stages").select("prospect_words, stage_number").eq("call_id", call_id).execute()
        stages = stages_res.data or []
        
        words_list = [s["prospect_words"] for s in stages if s.get("prospect_words")]
        combined_text = " ".join(words_list)
        
        if combined_text.strip():
            if not client:
                raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the backend")
            prompt = f"Summarize the following cold call notes/prospect words into a single, clean outcome sentence: {combined_text}"
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                outcome = response.text.strip()
            except Exception as e:
                outcome = f"Completed call (Summary error: {str(e)})"
        else:
            outcome = "Call closed with no conversation recorded."

    update_res = supabase.table("calls").update({"outcome": outcome}).eq("id", call_id).execute()
    return {"message": "Call closed successfully", "call": update_res.data[0]}

@app.get("/calls")
def list_calls():
    calls_res = supabase.table("calls").select("*").order("created_at", desc=True).execute()
    calls = calls_res.data or []
    
    for call in calls:
        stages_res = supabase.table("call_stages").select("stage_number").eq("call_id", call["id"]).order("stage_number", desc=True).limit(1).execute()
        stages = stages_res.data
        call["final_stage"] = stages[0]["stage_number"] if stages else 1
        
    return calls
