from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CompanyPreferences(Base):
    __tablename__ = "company_preferences"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False, index=True)
    schema_version = Column(Integer, default=1, nullable=False)
    general_config = Column(Text, default="{}", nullable=False)
    contribution_config = Column(Text, default="{}", nullable=False)
    withholding_config = Column(Text, default="{}", nullable=False)
    payroll_config = Column(Text, default="{}", nullable=False)
    documents_config = Column(Text, default="{}", nullable=False)
    corporate_identity_config = Column(Text, default="{}", nullable=False)
    language_config = Column(Text, default="{}", nullable=False)
    inherited_from_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    effective_from = Column(Date, nullable=True)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company", foreign_keys=[company_id])
    inherited_from_company = relationship("Company", foreign_keys=[inherited_from_company_id])
