from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EvaluationTaskScore(BaseModel):
    task_id: int
    title: str
    module: str
    section: str
    score: int
    attempts: int = 0
    status: str
    last_attempt_at: Optional[datetime] = None


class EvaluationSectionScore(BaseModel):
    key: str
    label: str
    score: int
    completed_tasks: int
    total_tasks: int
    tasks: list[EvaluationTaskScore] = Field(default_factory=list)


class EvaluationResultResponse(BaseModel):
    assignment_id: int
    evaluation_code: str
    title: str
    status: str
    score: int
    passed: bool
    pass_mark: int = 50
    completed_tasks: int
    total_tasks: int
    sections: list[EvaluationSectionScore] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
