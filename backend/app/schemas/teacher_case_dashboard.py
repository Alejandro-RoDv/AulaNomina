from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class TeacherCaseMetrics(BaseModel):
    total_assignments: int = 0
    assigned: int = 0
    in_progress: int = 0
    submitted: int = 0
    reviewed: int = 0
    approved: int = 0
    needs_revision: int = 0
    average_progress: int = 0
    failed_operations: int = 0
    tutor_messages: int = 0


class TeacherCaseAssignmentSummary(BaseModel):
    assignment_id: int
    case_study_id: int
    scenario_code: Optional[str] = None
    case_title: str
    assignee_name: str
    assignee_type: str
    status: str
    completion_percentage: int
    completed_steps: int
    total_steps: int
    current_step_title: Optional[str] = None
    failed_operations: int = 0
    tutor_messages: int = 0
    elapsed_minutes: int = 0
    due_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None


class TeacherCaseDashboardResponse(BaseModel):
    metrics: TeacherCaseMetrics
    assignments: list[TeacherCaseAssignmentSummary] = Field(default_factory=list)


class TeacherCaseTimelineEntry(BaseModel):
    timestamp: datetime
    entry_type: str
    title: str
    detail: Optional[str] = None
    status: Optional[str] = None
    task_id: Optional[int] = None
    task_order: Optional[int] = None
    actor: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class TeacherCaseStepDetail(BaseModel):
    task_id: int
    task_order: int
    title: str
    module: str
    expected_action: Optional[str] = None
    progress_status: str
    attempts: int
    event_count: int
    failed_operations: int
    student_notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_validation: dict[str, Any] = Field(default_factory=dict)


class TeacherCaseDetailResponse(TeacherCaseAssignmentSummary):
    description: Optional[str] = None
    difficulty: str
    category: str
    assigned_by: Optional[str] = None
    assigned_at: datetime
    notes: Optional[str] = None
    steps: list[TeacherCaseStepDetail] = Field(default_factory=list)
    timeline: list[TeacherCaseTimelineEntry] = Field(default_factory=list)
