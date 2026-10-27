import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai

app = FastAPI()

# CORS Middleware Setup
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# Initialize Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash") if GEMINI_API_KEY else None

class CallCreate(BaseModel):
    prospect_name: str
    company: str

class StageCreate(BaseModel):
    stage_number: int
    button_tapped: str
    prospect_words: str = ""

@app.get("/")
def root():
    return {"status": "Cold Call Co-Pilot API is running"}

@app.get("/calls")
def get_calls():
    res = supabase.table("calls").select("*").order("created_at", desc=True).execute()
    return res.data

@app.post("/calls")
def create_call(call: CallCreate):
    res = supabase.table("calls").insert({
        "prospect_name": call.prospect_name,
        "company": call.company,
        "status": "in_progress"
    }).execute()
    return res.data[0]

@app.post("/calls/{call_id}/stages")
def add_stage(call_id: str, stage: StageCreate):
    res = supabase.table("call_stages").insert({
        "call_id": call_id,
        "stage_number": stage.stage_number,
        "button_tapped": stage.button_tapped,
        "prospect_words": stage.prospect_words
    }).execute()
    return res.data[0]

@app.put("/calls/{call_id}")
def end_call(call_id: str):
    # 1. Fetch all logged stage responses for this call
    stages_res = supabase.table("call_stages").select("*").eq("call_id", call_id).order("stage_number").execute()
    stages = stages_res.data

    summary_text = "No summary generated."

    if model and stages:
        # 2. Build detailed prompt for Gemini
        stage_details = "\n".join([
            f"- Stage {s['stage_number']}: Outcome='{s['button_tapped']}', Prospect Notes='{s['prospect_words']}'"
            for s in stages
        ])
        
        prompt = (
            f"You are a sales coach. Summarize this cold call transcript into 2-3 concise sentences covering key interest, main pain point or objection, and agreed next steps:\n\n{stage_details}"
        )

        # 3. Generate summary with Gemini AI
        response = model.generate_content(prompt)
        summary_text = response.text.strip()

    # 4. Update the call status and outcome in Supabase
    res = supabase.table("calls").update({
        "status": "completed",
        "outcome": summary_text
    }).eq("id", call_id).execute()

    return {"status": "completed", "summary": summary_text, "call": res.data[0]}