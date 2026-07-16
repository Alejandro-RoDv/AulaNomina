from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CraConceptMapping(Base):
    __tablename__ = "cra_concept_mappings"

    id = Column(Integer, primary_key=True, index=True)
    payroll_concept_id = Column(
        Integer,
        ForeignKey("payroll_concepts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    cra_code = Column(String(4), nullable=False, index=True)
    base_indicator = Column(String(1), default="I", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    payroll_concept = relationship("PayrollConcept")

    @property
    def concept_name(self):
        return self.payroll_concept.name if self.payroll_concept else None

    @property
    def concept_code(self):
        return self.payroll_concept.code if self.payroll_concept else None

    @property
    def concept_type(self):
        return self.payroll_concept.concept_type if self.payroll_concept else None

    @property
    def category(self):
        return self.payroll_concept.category if self.payroll_concept else None
