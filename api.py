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
import requests
import numpy as np
from sklearn.metrics.pairwise import haversine_distances
from geopy.geocoders import Nominatim
from functools import lru_cache
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
GEMINI_API_KEY = "YOUR_API_KEY_HERE"   
GEMINI_MODEL = "gemini-3.1-flash-lite" 
MAX_CONCURRENT = 2        

client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=60 * 1000))
semaphore = asyncio.Semaphore(MAX_CONCURRENT)

# --- 1. THE HYBRID LOCATION ENGINE (FREE) ---
geolocator = Nominatim(user_agent="muuchstac_ats_hybrid")

@lru_cache(maxsize=1000)
def get_coordinates(city_name: str):
    if not city_name or city_name.lower() in ["not found", "n/a", "unknown"]:
        return None
    try:
        location = geolocator.geocode(f"{city_name}, India", timeout=5)
        if location:
            # We now also return the FULL official address so we can check the State
            return (location.latitude, location.longitude, location.address)
    except Exception as e:
        logger.error(f"Geocoding failed for {city_name}: {e}")
    return None

def calculate_hybrid_location_score(candidate_city: str, target_city: str = "Borivali, Mumbai") -> dict:
    if not candidate_city or not target_city:
        return {"relevancy": "Unknown", "status": "Location unknown."}

    # STAGE 0: The Broad City Bypass
    cand_clean = candidate_city.lower().replace("maharashtra", "").replace("india", "").strip(" ,.")
    target_clean = target_city.lower().replace("maharashtra", "").replace("india", "").strip(" ,.")
    
    cand_parts = [p.strip() for p in cand_clean.split(',') if p.strip()]
    target_parts = [p.strip() for p in target_clean.split(',') if p.strip()]

    if cand_clean == target_clean:
        return {"relevancy": "High", "status": "Exact match (Assumed Local)"}
    if len(cand_parts) == 1 and cand_parts[0] in target_parts:
        return {"relevancy": "High", "status": f"Broad city match - {cand_parts[0].title()} (Assumed Local)"}
    if len(target_parts) == 1 and target_parts[0] in cand_parts:
        return {"relevancy": "High", "status": f"Broad city match - {target_parts[0].title()} (Assumed Local)"}

    # STAGE 1: Scikit-Learn Fast Filter 
    cand_data = get_coordinates(candidate_city)
    office_data = get_coordinates(target_city)

    if not cand_data or not office_data:
        return {"relevancy": "Unknown", "status": "Location unknown."}

    # Extract coordinates and the full geographic address string
    cand_coords = (cand_data[0], cand_data[1])
    office_coords = (office_data[0], office_data[1])
    cand_address = cand_data[2].lower() 

    cand_rad = np.radians([cand_coords])
    office_rad = np.radians([office_coords])
    
    dist_matrix = haversine_distances(office_rad, cand_rad)
    straight_line_km = dist_matrix[0][0] * 6371.0  
    
    # --- IN-STATE BYPASS LOGIC ---
    if straight_line_km > 50.0:
        # Check if "Maharashtra" is in their official map address OR what they typed
        if "maharashtra" in cand_address or "maharashtra" in candidate_city.lower():
            return {"relevancy": "Low", "status": f"In-State ({straight_line_km:.1f} km away)"}
        else:
            return {"relevancy": "Relocation", "status": f"Out of State ({straight_line_km:.1f} km away)"}

    # STAGE 2: OSRM Routing Brain 
    lon1, lat1 = office_coords[1], office_coords[0]
    lon2, lat2 = cand_coords[1], cand_coords[0]
    
    try:
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        response = requests.get(osrm_url, timeout=5)
        data = response.json()
        
        if data.get("code") == "Ok":
            duration_seconds = data["routes"][0]["duration"]
            duration_mins = int(duration_seconds // 60)
            
            if duration_mins < 45:
                return {"relevancy": "High", "status": f"~{duration_mins} min drive (Excellent Commute)"}
            elif duration_mins <= 90:
                return {"relevancy": "Medium", "status": f"~{duration_mins} min drive (Moderate Commute)"}
            else:
                return {"relevancy": "Low", "status": f"~{duration_mins} min drive (Tough Commute)"}
    except Exception as e:
        logger.error(f"OSRM Routing failed: {e}")
    
    return {"relevancy": "Unknown", "status": f"{straight_line_km:.1f} km (API limits reached)"}

# --- 2. FASTAPI SETUP ---
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

class CandidateEvaluationAI(BaseModel):
    candidate_name: str       = Field(description="Full name extracted from resume")
    experience_score: int     = Field(description="Experience score out of 40")
    experience_details: str   = Field(description="1 short sentence explaining why they got this experience score")
    skills_score: int         = Field(description="Skills score out of 30")
    skills_details: str       = Field(description="1 short sentence explaining why they got this skills score")
    education_score: int      = Field(description="Education score out of 30")
    education_details: str    = Field(description="1 short sentence explaining why they got this education score")
    score_justification: str  = Field(description="One sentence overall justification")
    candidate_location: str   = Field(description="Specific City or area where candidate lives (e.g., 'Navi Mumbai', 'Pune')")
    contact_email: str        = Field(description="Candidate email")
    contact_phone: str        = Field(description="Candidate phone")
    experience_years: float   = Field(description="Years of relevant experience")
    skills: list[str]         = Field(description="Top matching skills")
    missing_requirements: list[str] = Field(description="Missing requirements")

class CandidateEvaluation(CandidateEvaluationAI):
    total_score: int = 0
    location_relevancy: str = ""
    location_details: str = ""
    is_qualified: bool = True
    source_file: str = Field(default="")

# --- 3. HELPER FUNCTIONS ---
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

def build_prompt(resume_text: str, jd: str, cfg: FilterConfig) -> str:
    return f"""You are an HR Gatekeeper. Respond in JSON. 

JD: {jd}
RESUME: {resume_text}

REQUIREMENTS:
Min Exp: {cfg.min_exp} yrs (Mandatory: {cfg.mand_exp})

SCORING (100 pts total for AI):
Exp (40 pts)
Skills (30 pts)
Edu (30 pts)

RULES:
1. If a requirement is Mandatory=True and candidate fails it, set is_qualified = false.
2. DO NOT score Location. Just extract the precise city/neighborhood for candidate_location.
"""

async def evaluate_resume(file_bytes: bytes, filename: str, jd: str, cfg: FilterConfig) -> dict:
    async with semaphore:
        try:
            text = await asyncio.to_thread(extract_text_from_bytes, file_bytes, filename)
            
            if not text or len(text.strip()) < 20:
                logger.error(f"Failed '{filename}': No readable text found.")
                return {"_failed": True, "_reason": f"Failed '{filename}': Could not read text (Scanned image or empty)."}

            prompt = build_prompt(text, jd, cfg)
            
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=CandidateEvaluationAI)
            )
            result = json.loads(response.text)
            result["is_qualified"] = True 
            
            # Add hybrid location processing (Relevancy instead of Points)
            geo_data = await asyncio.to_thread(calculate_hybrid_location_score, result["candidate_location"], cfg.target_loc)
            
            result["location_relevancy"] = geo_data["relevancy"]
            result["location_details"] = geo_data["status"]
            result["candidate_location"] = f'{result["candidate_location"]} - {geo_data["status"]}'

            if cfg.mand_loc and result["location_relevancy"] == "Relocation":
                result["is_qualified"] = False
                result["score_justification"] = f"Rejected: Location commute too far ({geo_data['status']})."

            calculated_total = result.get("experience_score", 0) + result.get("skills_score", 0) + result.get("education_score", 0)
            result["total_score"] = calculated_total

            if calculated_total < cfg.passing_score:
                result["is_qualified"] = False
                if "Rejected:" not in result.get("score_justification", ""):
                    result["score_justification"] = f"Rejected: Total score {calculated_total}/100 is below passing threshold."

            result["source_file"] = filename          
            return result
            
        except Exception as exc:
            logger.error(f"Pipeline crashed for {filename}: {exc}")
            return {"_failed": True, "_reason": f"Failed '{filename}': {exc}"}

# --- 4. API ENDPOINT ---
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
    target_location: str = Form("Borivali, Mumbai"),
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
    if not successes: raise HTTPException(status_code=500, detail="All files failed (Check terminal for details).")

    successes.sort(key=lambda c: (not c.get("is_qualified", False), -c.get("total_score", 0)))
    return successes[:shortlist_top_n] if shortlist_top_n > 0 else successes