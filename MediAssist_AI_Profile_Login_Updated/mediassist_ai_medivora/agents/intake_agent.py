def run_intake_agent(symptoms: str, age: int | None = None) -> dict:
    """Organizes user-entered information without diagnosing."""
    return {
        "agent": "Symptom Intake Agent",
        "summary": symptoms.strip(),
        "age_provided": age is not None,
        "follow_up_prompts": [
            "When did the symptoms begin?",
            "Are they getting better, staying the same, or getting worse?",
            "Are there other symptoms or relevant existing conditions?"
        ],
        "note": "These questions organize information for a qualified clinician; they do not determine a diagnosis."
    }
