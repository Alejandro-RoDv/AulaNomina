from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class SocialSecuritySettlement(Base):
    __tablename__ = "social_security_settlements"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "ccc_id",
            "period_year",
            "period_month",
            name="uq_social_security_settlement_period",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    ccc_id = Column(String(32), nullable=False, index=True)
    period_year = Column(Integer, nullable=False, index=True)
    period_month = Column(Integer, nullable=False, index=True)
    status = Column(String(32), default="DRAFT", nullable=False, index=True)

    worker_count = Column(Integer, default=0, nullable=False)
    contribution_days = Column(Integer, default=0, nullable=False)

    common_contingencies_base = Column(Numeric(14, 2), default=0, nullable=False)
    professional_contingencies_base = Column(Numeric(14, 2), default=0, nullable=False)
    unemployment_training_fogasa_base = Column(Numeric(14, 2), default=0, nullable=False)
    overtime_base = Column(Numeric(14, 2), default=0, nullable=False)

    employee_common_contingencies = Column(Numeric(14, 2), default=0, nullable=False)
    employee_unemployment = Column(Numeric(14, 2), default=0, nullable=False)
    employee_training = Column(Numeric(14, 2), default=0, nullable=False)
    employee_mei = Column(Numeric(14, 2), default=0, nullable=False)
    employee_total = Column(Numeric(14, 2), default=0, nullable=False)

    company_common_contingencies = Column(Numeric(14, 2), default=0, nullable=False)
    company_unemployment = Column(Numeric(14, 2), default=0, nullable=False)
    company_fogasa = Column(Numeric(14, 2), default=0, nullable=False)
    company_training = Column(Numeric(14, 2), default=0, nullable=False)
    company_at_ep = Column(Numeric(14, 2), default=0, nullable=False)
    company_mei = Column(Numeric(14, 2), default=0, nullable=False)
    company_total = Column(Numeric(14, 2), default=0, nullable=False)

    bonuses = Column(Numeric(14, 2), default=0, nullable=False)
    reductions = Column(Numeric(14, 2), default=0, nullable=False)
    total_due = Column(Numeric(14, 2), default=0, nullable=False)

    validation_errors = Column(Text, default="[]", nullable=False)
    communication_file_id = Column(Integer, ForeignKey("communication_files.id"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    prepared_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    generated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    communication_file = relationship("CommunicationFile")
    creator = relationship("User")
    lines = relationship(
        "SocialSecuritySettlementLine",
        back_populates="settlement",
        cascade="all, delete-orphan",
        order_by="SocialSecuritySettlementLine.employee_name, SocialSecuritySettlementLine.id",
    )


class SocialSecuritySettlementLine(Base):
    __tablename__ = "social_security_settlement_lines"
    __table_args__ = (
        UniqueConstraint(
            "settlement_id",
            "payroll_id",
            name="uq_social_security_settlement_payroll",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(
        Integer,
        ForeignKey("social_security_settlements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True, index=True)

    employee_code = Column(String(64), nullable=True)
    employee_name = Column(String(255), nullable=False)
    document = Column(String(32), nullable=True)
    naf = Column(String(32), nullable=True)
    contribution_group = Column(String(32), nullable=True)
    payroll_status = Column(String(32), nullable=False)
    contribution_days = Column(Integer, default=0, nullable=False)

    common_contingencies_base = Column(Numeric(14, 2), default=0, nullable=False)
    professional_contingencies_base = Column(Numeric(14, 2), default=0, nullable=False)
    unemployment_training_fogasa_base = Column(Numeric(14, 2), default=0, nullable=False)
    overtime_base = Column(Numeric(14, 2), default=0, nullable=False)

    employee_common_contingencies = Column(Numeric(14, 2), default=0, nullable=False)
    employee_unemployment = Column(Numeric(14, 2), default=0, nullable=False)
    employee_training = Column(Numeric(14, 2), default=0, nullable=False)
    employee_mei = Column(Numeric(14, 2), default=0, nullable=False)
    employee_total = Column(Numeric(14, 2), default=0, nullable=False)

    company_common_contingencies = Column(Numeric(14, 2), default=0, nullable=False)
    company_unemployment = Column(Numeric(14, 2), default=0, nullable=False)
    company_fogasa = Column(Numeric(14, 2), default=0, nullable=False)
    company_training = Column(Numeric(14, 2), default=0, nullable=False)
    company_at_ep = Column(Numeric(14, 2), default=0, nullable=False)
    company_mei = Column(Numeric(14, 2), default=0, nullable=False)
    company_total = Column(Numeric(14, 2), default=0, nullable=False)

    bonuses = Column(Numeric(14, 2), default=0, nullable=False)
    reductions = Column(Numeric(14, 2), default=0, nullable=False)
    total_due = Column(Numeric(14, 2), default=0, nullable=False)
    validation_errors = Column(Text, default="[]", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    settlement = relationship("SocialSecuritySettlement", back_populates="lines")
    payroll = relationship("Payroll")
    employee = relationship("Employee")
    contract = relationship("Contract")
    work_center = relationship("WorkCenter")
