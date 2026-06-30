from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import List
import pypdf
import docx
import io
import json
import asyncio
import logging
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

GEMINI_API_KEY    = "YOUR_GEMINI_KEY_HERE"   
GEMINI_MODEL      = "gemini-3.1-flash-lite"
MAX_CONCURRENT    = 2        
MAX_FILE_BYTES    = 5 * 1024 * 1024

client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=60 * 1000))
semaphore = asyncio.Semaphore(MAX_CONCURRENT)

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Muuchstac ATS Engine", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@dataclass
class FilterConfig:
    min_exp: float
    required_skills: str
    required_education: str
    target_loc: str
    mand_exp: bool
    mand_edu: bool
    mand_skill: bool
    mand_loc: bool
    passing_score: int

    @property
    def skills_label(self) -> str: return self.required_skills.strip() or "core skills listed in the JD"
    @property
    def edu_label(self) -> str: return self.required_education.strip() or "degree/qualification relevant to the JD"

# --- 1. THE AI BRAIN SCHEMA ---
class CandidateEvaluationAI(BaseModel):
    candidate_name: str       = Field(description="Full name extracted from resume")
    total_score: int          = Field(description="Composite score out of 100")
    experience_score: int     = Field(description="Experience score out of 30")
    skills_score: int         = Field(description="Skills score out of 30")
    education_score: int      = Field(description="Education score out of 30")
    location_score: int       = Field(description="Location score out of 10")
    is_qualified: bool        = Field(description="True if qualified based on passing score and mandatory filters")
    score_justification: str  = Field(description="One sentence justification")
    candidate_location: str   = Field(description="City/area where the candidate lives")
    contact_email: str        = Field(description="Candidate email")
    contact_phone: str        = Field(description="Candidate phone")
    experience_years: float   = Field(description="Years of relevant experience")
    skills: list[str]         = Field(description="Top matching skills")
    missing_requirements: list[str] = Field(description="Missing requirements")

class CandidateEvaluation(CandidateEvaluationAI):
    source_file: str = Field(default="")

# --- 2. TEXT EXTRACTION ---
def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    try:
        if filename.lower().endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            return " ".join(p.extract_text() for p in reader.pages if p.extract_text())
        elif filename.lower().endswith(".docx"):
            doc = docx.Document(io.BytesIO(file_bytes))
            parts = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text: parts.append(row_text)
            return " ".join(parts)
        raise ValueError(f"Unsupported file type")
    except Exception as e:
        raise ValueError(f"Could not read: {str(e)}")

# --- 3. THE AI PROMPT ---
def build_prompt(resume_text: str, jd: str, cfg: FilterConfig) -> str:
    return f"""You are an HR Gatekeeper. Respond in JSON. 

JD: {jd}
RESUME: {resume_text}

REQUIREMENTS:
Target Location: {cfg.target_loc} (Mandatory: {cfg.mand_loc})
Min Exp: {cfg.min_exp} yrs (Mandatory: {cfg.mand_exp})

SCORING (100 pts total):
Exp (30 pts)
Skills (30 pts)
Edu (30 pts)
Location (10 pts) - Score strictly based on how well their city matches the Target Location.

RULES:
1. If a requirement is Mandatory=True and the candidate fails it, set is_qualified = false.
2. If total_score < {cfg.passing_score}, set is_qualified = false.
"""

# --- 4. EXECUTION ---
async def evaluate_resume(file_bytes: bytes, filename: str, jd: str, cfg: FilterConfig) -> dict:
    async with semaphore:
        try:
            text   = await asyncio.to_thread(extract_text_from_bytes, file_bytes, filename)
            prompt = build_prompt(text, jd, cfg)
            
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=CandidateEvaluationAI)
            )
            result = json.loads(response.text)
            
            # Python Safety Check: Ensure the total score adds up correctly
            calculated_total = result.get("experience_score", 0) + result.get("skills_score", 0) + result.get("education_score", 0) + result.get("location_score", 0)
            result["total_score"] = calculated_total

            # Final check against your dashboard passing score
            if calculated_total < cfg.passing_score:
                result["is_qualified"] = False

            result["source_file"] = filename          
            return result
        except Exception as exc:
            return {"_failed": True, "_reason": f"Failed '{filename}': {exc}"}

@app.post("/analyze-batch-parallel/", response_model=list[CandidateEvaluation])
async def analyze_batch_parallel(
    response: Response,   
    files: List[UploadFile] = File(...),
    job_description: str = Form(...),
    min_experience_years: float = Form(0.0),
    mandatory_experience: bool = Form(False),
    required_skills: str = Form(""),
    mandatory_skills: bool = Form(False),
    required_education: str = Form(""),
    mandatory_education: bool = Form(False),
    target_location: str = Form("Mumbai"),
    mandatory_location: bool = Form(False),
    passing_score: int = Form(70),
    shortlist_top_n: int = Form(0),
):
    file_data = [(await f.read(), f.filename) for f in files if f.filename.lower().endswith((".pdf", ".docx"))]
    if not file_data: raise HTTPException(status_code=400, detail="No valid files.")

    cfg = FilterConfig(min_experience_years, required_skills, required_education, target_location, 
                       mandatory_experience, mandatory_education, mandatory_skills, mandatory_location, passing_score)

    tasks = [evaluate_resume(fb, fn, job_description, cfg) for fb, fn in file_data]
    raw_results = await asyncio.gather(*tasks)

    successes = [r for r in raw_results if not r.get("_failed")]
    if not successes: raise HTTPException(status_code=500, detail="All files failed.")

    # Sort so qualified and highest scores are at the top
    successes.sort(key=lambda c: (not c.get("is_qualified", False), -c.get("total_score", 0)))
    return successes[:shortlist_top_n] if shortlist_top_n > 0 else successes