import os
import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

def fallback_guidance(symptoms: str) -> str:
    return (
        "I can provide general information, but I cannot diagnose the cause of your symptoms.\n\n"
        f"You reported: {symptoms}\n\n"
        "Safe next steps:\n"
        "• Note when symptoms started and whether they are changing.\n"
        "• Consider contacting a qualified healthcare professional for personal advice.\n"
        "• Do not start, stop, or change medicines based on this chatbot.\n"
        "• Seek urgent help for severe or sudden symptoms, including breathing difficulty, chest pain, fainting, "
        "new weakness, confusion, or uncontrolled bleeding.\n\n"
        "This is general information, not a diagnosis or treatment plan."
    )

async def run_guidance_agent(symptoms: str, age: int | None = None) -> dict:
    prompt = f"""
You are a cautious health-information assistant for a student project. You are not a doctor.
Do not diagnose, give disease probabilities, prescribe or dose medicines, or tell people to change treatment.
Offer general information and safe next steps. Tell users to contact a qualified clinician for personal assessment.
Never delay emergency care for follow-up questions. Do not ask for identifying details.
Symptoms described: {symptoms}
Age: {age if age is not None else "not provided"}
Write short sections titled: General information, Safe next steps, When to seek urgent help.
Explicitly say this is not a diagnosis.
"""
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
                      "options": {"temperature": 0.2, "num_predict": 350}},
            )
            response.raise_for_status()
            answer = response.json().get("response", "").strip()
            if not answer:
                raise ValueError("Empty local model response")
            return {"agent": "Health Guidance Agent", "answer": answer,
                    "mode": "local model", "model": OLLAMA_MODEL}
    except Exception:
        return {"agent": "Health Guidance Agent",
                "answer": fallback_guidance(symptoms),
                "mode": "rule-based fallback",
                "model": None}
