from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String, unique=True, index=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    dni = Column(String, unique=True, index=True, nullable=False)
    naf = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    phone = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
    work_center = relationship("WorkCenter", back_populates="employees")
    contracts = relationship("Contract", back_populates="employee")
    incidents = relationship("Incident", back_populates="employee")
    payrolls = relationship("Payroll", back_populates="employee")
    documents = relationship("Document", back_populates="employee")
