from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from datetime import datetime
from app.db import Base
from sqlalchemy.orm import relationship


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    dni = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    hire_date = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    contracts = relationship("Contract", back_populates="employee")

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)