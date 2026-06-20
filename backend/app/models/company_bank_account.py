from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class CompanyBankAccount(Base):
    __tablename__ = "company_bank_accounts"
    __table_args__ = (UniqueConstraint("company_id", "iban", name="uq_company_bank_account_iban"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    label = Column(String, nullable=False, default="Cuenta bancaria")
    iban = Column(String(34), nullable=False)
    country_code = Column(String(2), nullable=False, default="ES")
    entity_code = Column(String(4), nullable=True)
    branch_code = Column(String(4), nullable=True)
    control_digits = Column(String(2), nullable=True)
    account_number = Column(String(10), nullable=True)
    is_fallback = Column(Boolean, nullable=False, default=False)
    is_simulated = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")


class CompanyPaymentAssignment(Base):
    __tablename__ = "company_payment_assignments"
    __table_args__ = (UniqueConstraint("company_id", "operation_code", name="uq_company_payment_operation"),)

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    operation_code = Column(String, nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("company_bank_accounts.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    account = relationship("CompanyBankAccount")
