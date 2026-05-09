from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class WorkCenter(Base):
    __tablename__ = "work_centers"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    center_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="work_centers")
    employees = relationship("Employee", back_populates="work_center")
    contracts = relationship("Contract", back_populates="work_center")
    incidents = relationship("Incident", back_populates="work_center")
    payrolls = relationship("Payroll", back_populates="work_center")

    @property
    def company_name(self):
        if not self.company:
            return None
        return self.company.name
