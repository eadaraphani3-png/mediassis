import os
import shutil
import sqlite3
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx

from agents.orchestrator import run_medical_assistance
from agents.safety_agent import run_safety_agent

BASE_DIR = Path(__file__).resolve().parent

def get_db_path() -> Path:
    """
    Returns a writable path for SQLite.
    On Vercel or AWS Lambda, the repository directory is mounted read-only.
    We detect this and route SQLite storage to the writable /tmp directory,
    copying any bundled seed database if available.
    """
    explicit = os.getenv("SQLITE_PATH") or os.getenv("DATABASE_PATH")
    if explicit:
        p = Path(explicit)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    can_write_base = False
    try:
        test_file = BASE_DIR / ".write_test"
        test_file.touch()
        test_file.unlink()
        can_write_base = True
    except Exception:
        can_write_base = False

    if is_serverless or not can_write_base:
        tmp_db = Path(tempfile.gettempdir()) / "mediassist.db"
        base_db = BASE_DIR / "mediassist.db"
        if base_db.exists() and not tmp_db.exists():
            try:
                shutil.copy2(base_db, tmp_db)
            except Exception:
                pass
        return tmp_db

    return BASE_DIR / "mediassist.db"

app = FastAPI(title="MediAssist AI", description="Local-first multi-agent healthcare support prototype", version="2.0.0")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@contextmanager
def db_connection():
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path), timeout=15)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    try:
        with db_connection() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL,
                content TEXT NOT NULL, created_at TEXT NOT NULL)""")
            conn.execute("""CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
                kind TEXT NOT NULL, remind_at TEXT NOT NULL, notes TEXT DEFAULT '',
                created_at TEXT NOT NULL)""")
    except Exception as e:
        print(f"Database initialization notice: {e}")

init_db()

class SymptomRequest(BaseModel):
    symptoms: str = Field(min_length=3, max_length=1500)
    age: Optional[int] = Field(default=None, ge=0, le=120)

class RecordCreate(BaseModel):
    category: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=3000)

class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    kind: str = Field(default="Appointment", max_length=40)
    remind_at: str = Field(min_length=10, max_length=40)
    notes: str = Field(default="", max_length=500)

@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "MediAssist AI", "architecture": "safety-first multi-agent prototype"}

@app.get("/api/summary")
def summary():
    try:
        with db_connection() as conn:
            records = conn.execute("SELECT COUNT(*) FROM records").fetchone()[0]
            reminders = conn.execute("SELECT COUNT(*) FROM reminders").fetchone()[0]
            upcoming = conn.execute("SELECT COUNT(*) FROM reminders WHERE remind_at >= ?",
                                    (datetime.now().isoformat(timespec="minutes"),)).fetchone()[0]
        return {"records": records, "reminders": reminders, "upcoming": upcoming}
    except Exception as e:
        return {"records": 0, "reminders": 0, "upcoming": 0, "warning": str(e)}

@app.post("/api/emergency-check")
def emergency_check(payload: SymptomRequest):
    return run_safety_agent(payload.symptoms)

@app.post("/api/symptoms")
async def symptoms(payload: SymptomRequest):
    return await run_medical_assistance(payload.symptoms, payload.age)

@app.get("/api/hospitals")
async def hospitals(city: str = Query(min_length=2, max_length=100)):
    city = city.strip()
    if not city:
        raise HTTPException(status_code=400, detail="Enter a city or area.")
    query = f"hospital in {city}"
    search_url = "https://www.openstreetmap.org/search?query=" + httpx.QueryParams({"query": query})["query"]
    try:
        async with httpx.AsyncClient(timeout=12, headers={
            "User-Agent": "MediAssistAIStudentProject/2.0 (educational prototype)"
        }) as client:
            response = await client.get("https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "jsonv2", "limit": 8, "addressdetails": 1})
            response.raise_for_status()
            data = response.json()
        results = []
        for item in data:
            address = item.get("display_name", "")
            lat, lon = item.get("lat"), item.get("lon")
            results.append({
                "name": address.split(",")[0] if address else "Medical facility",
                "address": address, "lat": lat, "lon": lon,
                "map_url": f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=16/{lat}/{lon}"
            })
        return {"city": city, "results": results, "search_url": search_url,
                "note": "Map listings may be incomplete or outdated. Call the facility to verify details. Not an emergency dispatch service."}
    except Exception:
        return {"city": city, "results": [], "search_url": search_url,
                "note": "Live map search failed. Open the map search link and verify details directly."}

@app.get("/api/records")
def list_records():
    try:
        with db_connection() as conn:
            rows = conn.execute("SELECT * FROM records ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve health records: {e}")

@app.post("/api/records")
def create_record(payload: RecordCreate):
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with db_connection() as conn:
            cur = conn.execute("INSERT INTO records(category,content,created_at) VALUES(?,?,?)",
                               (payload.category.strip(), payload.content.strip(), now))
            row = conn.execute("SELECT * FROM records WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save record: {e}")

@app.delete("/api/records/{record_id}")
def delete_record(record_id: int):
    try:
        with db_connection() as conn:
            cur = conn.execute("DELETE FROM records WHERE id=?", (record_id,))
            if not cur.rowcount:
                raise HTTPException(status_code=404, detail="Record not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {e}")

@app.get("/api/reminders")
def list_reminders():
    try:
        with db_connection() as conn:
            rows = conn.execute("SELECT * FROM reminders ORDER BY remind_at ASC").fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve care reminders: {e}")

@app.post("/api/reminders")
def create_reminder(payload: ReminderCreate):
    try:
        parsed = datetime.fromisoformat(payload.remind_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="Use a valid date and time.")
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with db_connection() as conn:
            cur = conn.execute(
                "INSERT INTO reminders(title,kind,remind_at,notes,created_at) VALUES(?,?,?,?,?)",
                (payload.title.strip(), payload.kind.strip(), parsed.isoformat(timespec="minutes"),
                 payload.notes.strip(), now))
            row = conn.execute("SELECT * FROM reminders WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save reminder: {e}")

@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: int):
    try:
        with db_connection() as conn:
            cur = conn.execute("DELETE FROM reminders WHERE id=?", (reminder_id,))
            if not cur.rowcount:
                raise HTTPException(status_code=404, detail="Reminder not found")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reminder: {e}")

