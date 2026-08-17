from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class ContractLifecycleEvent(Base):
    __tablename__ = "contract_lifecycle_events"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    effective_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    previous_state = Column(JSON, nullable=False, default=dict)
    new_state = Column(JSON, nullable=False, default=dict)
    related_contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    contract = relationship("Contract", foreign_keys=[contract_id])
    related_contract = relationship("Contract", foreign_keys=[related_contract_id])
