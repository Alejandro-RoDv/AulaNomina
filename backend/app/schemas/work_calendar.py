from datetime import datetime

from pydantic import BaseModel


class WorkCalendarBase(BaseModel):
    name: str
    period_type: str = "todo_el_ano"
    winter_period: str | None = None
    summer_period: str | None = None
    rest_type: str = "semanal"
    rest_days: str | None = None
    schedule_data: str | None = None
    shifts_enabled: bool = False
    shift_1: str | None = None
    shift_2: str | None = None
    shift_3: str | None = None
    shift_4: str | None = None
    is_active: bool = True


class WorkCalendarCreate(WorkCalendarBase):
    pass


class WorkCalendarUpdate(BaseModel):
    name: str | None = None
    period_type: str | None = None
    winter_period: str | None = None
    summer_period: str | None = None
    rest_type: str | None = None
    rest_days: str | None = None
    schedule_data: str | None = None
    shifts_enabled: bool | None = None
    shift_1: str | None = None
    shift_2: str | None = None
    shift_3: str | None = None
    shift_4: str | None = None
    is_active: bool | None = None


class WorkCalendarResponse(WorkCalendarBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
