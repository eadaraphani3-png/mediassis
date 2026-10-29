from agents.safety_agent import run_safety_agent
from agents.intake_agent import run_intake_agent
from agents.guidance_agent import run_guidance_agent
from agents.routing_agent import run_routing_agent

async def run_medical_assistance(symptoms: str, age: int | None = None) -> dict:
    """Simple sequential multi-agent workflow with safety-first ordering."""
    safety = run_safety_agent(symptoms)
    intake = run_intake_agent(symptoms, age)
    routing = run_routing_agent(symptoms, safety["urgent"])

    # Safety gate: don't send emergency descriptions to the LLM.
    if safety["urgent"]:
        guidance = {
            "agent": "Health Guidance Agent",
            "mode": "safety response",
            "model": None,
            "answer": (
                "URGENT SAFETY NOTICE\n\n"
                + "\n".join("• " + item for item in safety["messages"])
                + "\n\nContact your local emergency number or go to the nearest emergency department now. "
                  "Do not wait for this app or an AI response. Ask someone nearby to help if possible."
            ),
        }
    else:
        guidance = await run_guidance_agent(symptoms, age)

    return {
        "urgent": safety["urgent"],
        "safety": safety,
        "intake": intake,
        "guidance": guidance,
        "routing": routing,
    }
