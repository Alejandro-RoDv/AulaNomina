from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class EmployeeAssignmentHistoryResponse(BaseModel):
    id: int
    employee_id: int
    company_id: Optional[int] = None
    center_id: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    employee_name: Optional[str] = None
    company_name: Optional[str] = None
    center_name: Optional[str] = None

    class Config:
        from_attributes = True
