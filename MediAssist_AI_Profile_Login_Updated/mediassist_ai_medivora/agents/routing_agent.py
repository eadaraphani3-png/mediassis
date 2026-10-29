def run_routing_agent(symptoms: str, urgent: bool) -> dict:
    """Suggests a type of professional to contact, never a diagnosis."""
    text = symptoms.lower()
    if urgent:
        return {
            "agent": "Care Navigation Agent",
            "suggestion": "Emergency medical services or the nearest emergency department",
            "reason": "A selected emergency warning phrase was detected.",
            "disclaimer": "Do not wait for this application. The keyword screen is limited."
        }
    if any(word in text for word in ["rash", "itch", "skin", "acne"]):
        suggestion = "A general physician can assess this and advise whether dermatology is appropriate."
    elif any(word in text for word in ["tooth", "teeth", "gum", "dental"]):
        suggestion = "A dentist may be an appropriate starting point."
    elif any(word in text for word in ["eye", "vision", "eyelid"]):
        suggestion = "An eye-care professional may be an appropriate starting point."
    else:
        suggestion = "A qualified general physician or primary-care clinician can assess your concerns and guide next steps."
    return {
        "agent": "Care Navigation Agent",
        "suggestion": suggestion,
        "reason": "This is general navigation guidance based on keywords, not a clinical referral.",
        "disclaimer": "If symptoms are severe, sudden, or worsening, seek urgent care."
    }
