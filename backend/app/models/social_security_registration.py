from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class SocialSecurityRegistration(Base):
    __tablename__ = "social_security_registrations"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, unique=True)

    situation_code = Column(String, nullable=True)
    situation_description = Column(String, nullable=True)
    registration_date = Column(Date, nullable=True)

    contribution_group = Column(String, nullable=True)
    monthly_or_daily_contribution = Column(String, nullable=True)
    disability_degree = Column(Float, nullable=True)
    occupation_code = Column(String, nullable=True)
    cno = Column(String, nullable=True)

    worker_collective_code = Column(String, nullable=True)
    unemployed_condition_code = Column(String, nullable=True)
    social_exclusion_or_victim_status = Column(String, nullable=True)

    is_replacement = Column(Boolean, default=False, nullable=False)
    replacement_cause_code = Column(String, nullable=True)
    replaced_worker_naf = Column(String, nullable=True)

    inactivity_type_code = Column(String, nullable=True)

    working_time_reduction = Column(Float, nullable=True)
    initial_ctp = Column(Float, nullable=True)

    red_contract_key = Column(String, nullable=True)
    red_occupation_code = Column(String, nullable=True)
    red_contribution_group = Column(String, nullable=True)
    red_reduction_code = Column(String, nullable=True)
    red_special_relation = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    contract = relationship("Contract", back_populates="ss_registration")
