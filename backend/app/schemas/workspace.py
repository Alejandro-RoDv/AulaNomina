from typing import Literal

from pydantic import BaseModel, Field


class TutorialState(BaseModel):
    phase: Literal["onboarding", "familiarization", "hidden"] = "onboarding"
    slideIndex: int = Field(default=0, ge=0, le=3)
    familiarizationIndex: int = Field(default=0, ge=0, le=3)
    completed: bool = False
    dismissed: bool = False


class TutorialStateResponse(TutorialState):
    workspace_id: int
    initialized: bool = True
