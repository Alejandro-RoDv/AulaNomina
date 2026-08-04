from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Tax190Key(Base):
    __tablename__ = "tax_190_keys"
    __table_args__ = (
        UniqueConstraint("code", "valid_from", name="uq_tax_190_key_code_version"),
        Index("ix_tax_190_key_active_period", "active", "valid_from", "valid_to"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(1), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    recipient_type = Column(String(30), nullable=False, index=True)
    valid_from = Column(Integer, nullable=False, index=True)
    valid_to = Column(Integer, nullable=True, index=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Tax190Subkey(Base):
    __tablename__ = "tax_190_subkeys"
    __table_args__ = (
        UniqueConstraint(
            "key_code",
            "code",
            "valid_from",
            name="uq_tax_190_subkey_code_version",
        ),
        Index("ix_tax_190_subkey_active_period", "active", "valid_from", "valid_to"),
    )

    id = Column(Integer, primary_key=True, index=True)
    key_code = Column(String(1), nullable=False, index=True)
    code = Column(String(2), nullable=False, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    valid_from = Column(Integer, nullable=False, index=True)
    valid_to = Column(Integer, nullable=True, index=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Model190Declaration(Base):
    __tablename__ = "model_190_declarations"
    __table_args__ = (
        Index("ix_model_190_declaration_company_year", "company_id", "year"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    declaration_type = Column(String(20), default="ordinary", nullable=False, index=True)
    original_declaration_id = Column(
        Integer,
        ForeignKey("model_190_declarations.id"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), default="draft", nullable=False, index=True)
    generated_at = Column(DateTime, nullable=True)
    presented_at = Column(DateTime, nullable=True)
    locked = Column(Boolean, default=False, nullable=False)
    total_recipients = Column(Integer, default=0, nullable=False)
    total_cash_income = Column(Numeric(14, 2), default=0, nullable=False)
    total_in_kind_income = Column(Numeric(14, 2), default=0, nullable=False)
    total_withholding = Column(Numeric(14, 2), default=0, nullable=False)
    total_deductible_expenses = Column(Numeric(14, 2), default=0, nullable=False)
    payload = Column(Text, nullable=True)
    validation_result = Column(Text, nullable=True)
    receipt_number = Column(String(30), nullable=True, index=True)
    csv = Column(String(50), nullable=True, index=True)
    presentation_reference = Column(String(80), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    original_declaration = relationship("Model190Declaration", remote_side=[id])
    recipients = relationship(
        "Model190Recipient",
        back_populates="declaration",
        cascade="all, delete-orphan",
        order_by="Model190Recipient.id",
    )


class Model190Recipient(Base):
    __tablename__ = "model_190_recipients"
    __table_args__ = (
        UniqueConstraint(
            "declaration_id",
            "nif",
            "key",
            "subkey",
            "accrual_year",
            name="uq_model_190_recipient_snapshot",
        ),
        Index("ix_model_190_recipient_lookup", "declaration_id", "nif", "key", "subkey"),
    )

    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(
        Integer,
        ForeignKey("model_190_declarations.id"),
        nullable=False,
        index=True,
    )
    recipient_type = Column(String(30), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=True, index=True)
    nif = Column(String(20), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    surname = Column(String(180), nullable=True)
    key = Column(String(1), nullable=False, index=True)
    subkey = Column(String(2), nullable=True, index=True)
    cash_income = Column(Numeric(14, 2), default=0, nullable=False)
    cash_withholding = Column(Numeric(14, 2), default=0, nullable=False)
    in_kind_income = Column(Numeric(14, 2), default=0, nullable=False)
    in_kind_payment_on_account = Column(Numeric(14, 2), default=0, nullable=False)
    in_kind_payment_repercuted = Column(Numeric(14, 2), default=0, nullable=False)
    deductible_expenses = Column(Numeric(14, 2), default=0, nullable=False)
    reductions = Column(Numeric(14, 2), default=0, nullable=False)
    accrual_year = Column(Integer, nullable=False, index=True)
    province_code = Column(String(2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    declaration = relationship("Model190Declaration", back_populates="recipients")
    employee = relationship("Employee")
    professional = relationship("Professional")
    lines = relationship(
        "Model190RecipientLine",
        back_populates="recipient",
        cascade="all, delete-orphan",
        order_by="Model190RecipientLine.source_date, Model190RecipientLine.id",
    )

    @property
    def full_name(self) -> str:
        return " ".join(part for part in [self.name, self.surname] if part).strip()


class Model190RecipientLine(Base):
    __tablename__ = "model_190_recipient_lines"
    __table_args__ = (
        Index("ix_model_190_line_source", "source_type", "source_id"),
        Index("ix_model_190_line_quarter", "model190_recipient_id", "quarter"),
    )

    id = Column(Integer, primary_key=True, index=True)
    model190_recipient_id = Column(
        Integer,
        ForeignKey("model_190_recipients.id"),
        nullable=False,
        index=True,
    )
    source_type = Column(String(30), nullable=False, index=True)
    source_id = Column(Integer, nullable=True)
    source_label = Column(String(255), nullable=False)
    source_date = Column(Date, nullable=False, index=True)
    amount_type = Column(String(30), nullable=False, index=True)
    gross_amount = Column(Numeric(14, 2), default=0, nullable=False)
    withholding_amount = Column(Numeric(14, 2), default=0, nullable=False)
    deductible_expense_amount = Column(Numeric(14, 2), default=0, nullable=False)
    model111_declaration_id = Column(
        Integer,
        ForeignKey("model_111_declarations.id"),
        nullable=True,
        index=True,
    )
    quarter = Column(String(2), nullable=True, index=True)

    recipient = relationship("Model190Recipient", back_populates="lines")
    model111_declaration = relationship("Model111Declaration")


class Model190RecipientOverride(Base):
    __tablename__ = "model_190_recipient_overrides"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "year",
            "recipient_type",
            "recipient_id",
            name="uq_model_190_recipient_override",
        ),
        Index("ix_model_190_override_company_year", "company_id", "year"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    recipient_type = Column(String(30), nullable=False, index=True)
    recipient_id = Column(Integer, nullable=False, index=True)
    key = Column(String(1), nullable=True, index=True)
    subkey = Column(String(2), nullable=True, index=True)
    accrual_year = Column(Integer, nullable=True, index=True)
    province_code = Column(String(2), nullable=True)
    notes = Column(Text, nullable=True)
    confirmed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
