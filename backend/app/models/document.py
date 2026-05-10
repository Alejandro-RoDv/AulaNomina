from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    document_type = Column(String, nullable=False)
    document_name = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="documents")
    company = relationship("Company", back_populates="documents")
    work_center = relationship("WorkCenter", back_populates="documents")
