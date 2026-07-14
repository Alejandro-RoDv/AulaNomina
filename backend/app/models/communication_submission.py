from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class CommunicationSubmission(Base):
    __tablename__ = "communication_submissions"
    __table_args__ = (
        UniqueConstraint("submission_number", name="uq_communication_submission_number"),
        UniqueConstraint(
            "communication_file_id",
            "attempt_number",
            name="uq_communication_submission_attempt",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    communication_file_id = Column(
        Integer,
        ForeignKey("communication_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    submission_number = Column(String(40), nullable=False, unique=True, index=True)
    attempt_number = Column(Integer, nullable=False)
    status = Column(String(40), default="PENDING", nullable=False, index=True)

    submitted_at = Column(DateTime, nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, nullable=True)

    response_code = Column(String(20), nullable=True)
    response_message = Column(Text, nullable=True)
    response_file_id = Column(Integer, ForeignKey("communication_files.id"), nullable=True)
    messages = Column(Text, default="[]", nullable=False)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    source_file = relationship("CommunicationFile", foreign_keys=[communication_file_id])
    response_file = relationship("CommunicationFile", foreign_keys=[response_file_id])
    company = relationship("Company")
    creator = relationship("User", foreign_keys=[created_by])
