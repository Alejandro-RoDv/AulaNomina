from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Professional(Base):
    __tablename__ = "professionals"
    __table_args__ = (
        UniqueConstraint("company_id", "nif", name="uq_professional_company_nif"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    nif = Column(String(20), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    surname = Column(String(180), nullable=True)
    activity_type = Column(String(50), default="professional", nullable=False)
    withholding_rate = Column(Numeric(5, 2), default=15, nullable=False)
    address = Column(String(255), nullable=True)
    province_code = Column(String(2), nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    invoices = relationship(
        "ProfessionalInvoice",
        back_populates="professional",
        cascade="all, delete-orphan",
    )

    @property
    def full_name(self) -> str:
        return " ".join(part for part in [self.name, self.surname] if part).strip()


class ProfessionalInvoice(Base):
    __tablename__ = "professional_invoices"
    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_professional_invoice_company_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    professional_id = Column(Integer, ForeignKey("professionals.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    invoice_number = Column(String(80), nullable=False)
    invoice_date = Column(Date, nullable=False, index=True)
    payment_date = Column(Date, nullable=True, index=True)
    tax_base = Column(Numeric(12, 2), default=0, nullable=False)
    withholding_rate = Column(Numeric(5, 2), default=15, nullable=False)
    withholding_amount = Column(Numeric(12, 2), default=0, nullable=False)
    total_amount = Column(Numeric(12, 2), default=0, nullable=False)
    status = Column(String(20), default="draft", nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    professional = relationship("Professional", back_populates="invoices")
    company = relationship("Company")

    @property
    def fiscal_date(self) -> date:
        return self.payment_date or self.invoice_date


class TaxWithholdingAdjustment(Base):
    __tablename__ = "tax_withholding_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    category = Column(String(30), nullable=False, index=True)  # work | economic_activity
    adjustment_type = Column(String(30), default="manual", nullable=False)  # manual | regularization | arrears
    source_date = Column(Date, nullable=False, index=True)
    recipient_nif = Column(String(20), nullable=False)
    recipient_name = Column(String(255), nullable=False)
    base_amount = Column(Numeric(12, 2), default=0, nullable=False)
    withholding_amount = Column(Numeric(12, 2), default=0, nullable=False)
    status = Column(String(20), default="confirmed", nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    company = relationship("Company")


class Model111Declaration(Base):
    __tablename__ = "model_111_declarations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    period = Column(String(2), nullable=False, index=True)
    period_type = Column(String(20), default="quarterly", nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    declaration_type = Column(String(20), default="ordinary", nullable=False)
    original_declaration_id = Column(
        Integer,
        ForeignKey("model_111_declarations.id"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), default="generated", nullable=False, index=True)
    result_type = Column(String(20), nullable=False)
    work_perceptors = Column(Integer, default=0, nullable=False)
    work_base = Column(Numeric(14, 2), default=0, nullable=False)
    work_withholding = Column(Numeric(14, 2), default=0, nullable=False)
    professional_perceptors = Column(Integer, default=0, nullable=False)
    professional_base = Column(Numeric(14, 2), default=0, nullable=False)
    professional_withholding = Column(Numeric(14, 2), default=0, nullable=False)
    total_withholding = Column(Numeric(14, 2), default=0, nullable=False)
    previous_result = Column(Numeric(14, 2), default=0, nullable=False)
    result_amount = Column(Numeric(14, 2), default=0, nullable=False)
    payload_json = Column(Text, nullable=False)
    validation_json = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    presented_at = Column(DateTime, nullable=True)
    payment_method = Column(String(30), nullable=True)
    nrc = Column(String(40), nullable=True)
    receipt_number = Column(String(20), nullable=True, index=True)
    csv = Column(String(40), nullable=True, index=True)
    locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    original_declaration = relationship("Model111Declaration", remote_side=[id])
    lines = relationship(
        "Model111Line",
        back_populates="declaration",
        cascade="all, delete-orphan",
        order_by="Model111Line.id",
    )


class Model111Line(Base):
    __tablename__ = "model_111_lines"

    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(Integer, ForeignKey("model_111_declarations.id"), nullable=False, index=True)
    category = Column(String(30), nullable=False, index=True)
    source_type = Column(String(30), nullable=False)
    source_id = Column(Integer, nullable=True)
    source_date = Column(Date, nullable=False)
    source_label = Column(String(255), nullable=False)
    recipient_key = Column(String(80), nullable=False)
    recipient_nif = Column(String(20), nullable=True)
    recipient_name = Column(String(255), nullable=False)
    base_amount = Column(Numeric(14, 2), default=0, nullable=False)
    withholding_amount = Column(Numeric(14, 2), default=0, nullable=False)

    declaration = relationship("Model111Declaration", back_populates="lines")
