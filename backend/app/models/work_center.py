from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class WorkCenter(Base):
    __tablename__ = "work_centers"
    __table_args__ = (
        UniqueConstraint("workspace_id", "center_code", name="uq_work_centers_workspace_code"),
        UniqueConstraint("workspace_id", "main_ccc", name="uq_work_centers_workspace_ccc"),
    )

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("training_workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    center_code = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    general_ccc = Column(String, nullable=True)
    main_ccc = Column(String, index=True, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    collective_agreement = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    fax = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="work_centers")
    employees = relationship("Employee", back_populates="work_center")
    contracts = relationship("Contract", back_populates="work_center")
    incidents = relationship("Incident", back_populates="work_center")
    payrolls = relationship("Payroll", back_populates="work_center")
    documents = relationship("Document", back_populates="work_center")

    @property
    def company_name(self):
        if not self.company:
            return None
        return self.company.name
