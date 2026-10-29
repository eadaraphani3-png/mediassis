import re

# Conservative examples only; this is not a complete emergency detector.
EMERGENCY_RULES = [
    (r"\b(chest pain|chest pressure|crushing chest pain)\b",
     "Chest pain or pressure can be an emergency."),
    (r"\b(can't breathe|cannot breathe|difficulty breathing|severe shortness of breath)\b",
     "Severe breathing difficulty can be an emergency."),
    (r"\b(face droop|facial drooping|slurred speech|sudden weakness|one side weak)\b",
     "Sudden weakness or speech changes may be signs of a stroke."),
    (r"\b(unconscious|not waking up|seizure right now)\b",
     "Unconsciousness or an ongoing seizure needs urgent medical help."),
    (r"\b(severe bleeding|bleeding won't stop|heavy bleeding)\b",
     "Severe bleeding needs urgent medical help."),
    (r"\b(overdose|poisoning|swallowed poison)\b",
     "A possible overdose or poisoning needs urgent expert help."),
    (r"\b(want to kill myself|going to hurt myself|suicidal)\b",
     "You may be in immediate danger. Contact emergency services or a crisis service now and tell a trusted person nearby."),
]

def run_safety_agent(text: str) -> dict:
    messages = [message for pattern, message in EMERGENCY_RULES
                if re.search(pattern, text, re.IGNORECASE)]
    return {
        "agent": "Safety & Emergency Agent",
        "urgent": bool(messages),
        "messages": messages,
        "disclaimer": "This limited keyword screen can miss emergencies. Severe, sudden, or worsening symptoms need urgent professional assessment even if no alert appears."
    }
