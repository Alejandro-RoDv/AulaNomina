from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String, unique=True, index=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    document_type = Column(String, default="DNI", nullable=False)
    dni = Column(String, unique=True, index=True, nullable=False)
    nie_prefix = Column(String, nullable=True)
    document_number = Column(String, nullable=True)
    document_letter = Column(String, nullable=True)
    naf = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    second_last_name = Column(String, nullable=True)
    sex = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    nationality = Column(String, nullable=True)
    birth_place = Column(String, nullable=True)
    domicile = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    province = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    landline_phone = Column(String, nullable=True)
    mobile_phone = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    fax = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    website = Column(String, nullable=True)
    education_level = Column(String, nullable=True)
    academic_title = Column(String, nullable=True)
    academic_title_date = Column(Date, nullable=True)
    main_profession = Column(String, nullable=True)
    other_courses = Column(Text, nullable=True)
    accreditations = Column(Text, nullable=True)
    languages = Column(Text, nullable=True)
    representative_role = Column(String, nullable=True)
    representative_nif = Column(String, nullable=True)
    representative_full_name = Column(String, nullable=True)
    observations = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
    work_center = relationship("WorkCenter", back_populates="employees")
    contracts = relationship("Contract", back_populates="employee")
    incidents = relationship("Incident", back_populates="employee")
    payrolls = relationship("Payroll", back_populates="employee")
    documents = relationship("Document", back_populates="employee")
    assignment_history = relationship("EmployeeAssignmentHistory", back_populates="employee", order_by="EmployeeAssignmentHistory.start_date.desc()")
    tax_profile = relationship("TaxProfile", back_populates="employee", uselist=False, cascade="all, delete-orphan")
