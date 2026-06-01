from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.db import Base


class WorkCalendar(Base):
    __tablename__ = "work_calendars"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    period_type = Column(String, default="todo_el_ano", nullable=False)
    winter_period = Column(String, nullable=True)
    summer_period = Column(String, nullable=True)
    rest_type = Column(String, default="semanal", nullable=False)
    rest_days = Column(String, nullable=True)
    schedule_data = Column(Text, nullable=True)
    shifts_enabled = Column(Boolean, default=False, nullable=False)
    shift_1 = Column(String, nullable=True)
    shift_2 = Column(String, nullable=True)
    shift_3 = Column(String, nullable=True)
    shift_4 = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
