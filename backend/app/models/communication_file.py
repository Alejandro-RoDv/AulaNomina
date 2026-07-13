from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CommunicationFile(Base):
    __tablename__ = "communication_files"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    ccc_id = Column(String(32), nullable=True, index=True)
    period = Column(String(10), nullable=False, index=True)
    file_type = Column(String(64), nullable=False, index=True)
    status = Column(String(40), default="DRAFT", nullable=False, index=True)

    generated_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)

    original_filename = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    file_metadata = Column("metadata", Text, default="{}", nullable=False)
    validation_errors = Column(Text, default="[]", nullable=False)

    response_code = Column(String(100), nullable=True)
    response_message = Column(Text, nullable=True)
    response_file_id = Column(Integer, ForeignKey("communication_files.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    creator = relationship("User", foreign_keys=[created_by])
    response_file = relationship("CommunicationFile", remote_side=[id], foreign_keys=[response_file_id])
    events = relationship(
        "CommunicationFileEvent",
        back_populates="communication_file",
        cascade="all, delete-orphan",
        order_by="CommunicationFileEvent.created_at, CommunicationFileEvent.id",
    )


class CommunicationFileEvent(Base):
    __tablename__ = "communication_file_events"

    id = Column(Integer, primary_key=True, index=True)
    communication_file_id = Column(
        Integer,
        ForeignKey("communication_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False, index=True)
    from_status = Column(String(40), nullable=True)
    to_status = Column(String(40), nullable=True)
    message = Column(Text, nullable=True)
    details = Column(Text, default="{}", nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    communication_file = relationship("CommunicationFile", back_populates="events")
    creator = relationship("User", foreign_keys=[created_by])
