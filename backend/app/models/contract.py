from sqlalchemy import Boolean, Column, Integer, String, Date, DateTime, ForeignKey, Numeric, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)

    # Datos contractuales básicos
    contract_type = Column(String, nullable=False)
    contract_code = Column(String, nullable=True)
    contract_code_description = Column(String, nullable=True)
    contract_family = Column(String, nullable=True)
    start_date = Column(Date, nullable=False)
    seniority_date = Column(Date, nullable=True)
    seniority_criterion = Column(String, nullable=True)
    end_date = Column(Date, nullable=True)
    termination_reason = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)

    # Transformación contractual
    transformation_from_contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True)
    transformation_date = Column(Date, nullable=True)
    transformation_reason = Column(String, nullable=True)

    # Bonificación vigente o principal del contrato
    bonus_type = Column(String, nullable=True)
    bonus_start_date = Column(Date, nullable=True)
    bonus_end_date = Column(Date, nullable=True)
    bonus_fixed_fee = Column(Numeric(10, 2), nullable=True)
    bonus_observations = Column(String, nullable=True)

    # Categoría, puesto y convenio
    contribution_group = Column(String, nullable=True)
    professional_category = Column(String, nullable=True)
    job_position = Column(String, nullable=True)
    collective_agreement_code = Column(String, nullable=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    salary_table_row_id = Column(Integer, ForeignKey("salary_table_rows.id"), nullable=True)

    # Jornada y parcialidad
    working_day_type = Column(String, nullable=True)
    weekly_hours = Column(Float, nullable=True)
    full_time_weekly_hours = Column(Float, default=40)
    annual_agreement_hours = Column(Float, nullable=True)
    monthly_hours = Column(Float, nullable=True)
    annual_hours = Column(Float, nullable=True)
    partiality_coefficient = Column(Float, nullable=True)
    ordinary_hours = Column(Float, nullable=True)
    ordinary_hours_period = Column(String, nullable=True)
    comparison_reference_type = Column(String, nullable=True)
    comparison_hours = Column(Float, nullable=True)
    work_distribution = Column(String, nullable=True)
    pay_accrual_mode = Column(String, nullable=True)
    contribution_hours_mode = Column(String, nullable=True)

    # Reducción legal e inactividad
    legal_workday_reduction_cause = Column(String, nullable=True)
    legal_workday_reduction_start = Column(Date, nullable=True)
    legal_workday_reduction_end = Column(Date, nullable=True)
    legal_workday_reduction_percentage = Column(Float, nullable=True)
    inactivity_start_date = Column(Date, nullable=True)
    inactivity_return_date = Column(Date, nullable=True)
    inactivity_start_communication_date = Column(Date, nullable=True)
    inactivity_return_communication_date = Column(Date, nullable=True)

    # Festivos y horario
    works_holidays = Column(Boolean, default=False, nullable=False)
    holiday_scope = Column(String, nullable=True)
    holiday_only_service_days = Column(Boolean, default=False, nullable=False)
    schedule_notes = Column(String, nullable=True)

    # Afiliación y subrogación
    health_card_number = Column(String, nullable=True)
    subrogation = Column(Boolean, default=False, nullable=False)
    subrogation_company_origin = Column(String, nullable=True)
    subrogation_date = Column(Date, nullable=True)
    recognized_seniority_date = Column(Date, nullable=True)
    affects_extra_payments = Column(Boolean, default=False, nullable=False)

    # Tipo de relación y datos RED/administrativos
    relation_type = Column(String, nullable=True)
    representation_type = Column(String, nullable=True)
    relation_subtype = Column(String, nullable=True)
    registration_number = Column(String, nullable=True)
    authorization_number = Column(String, nullable=True)
    red_key = Column(String, nullable=True)
    red_cont = Column(String, nullable=True)
    cno_code = Column(String, nullable=True)
    cno_description = Column(String, nullable=True)
    company_cnae = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    it_rate = Column(Float, nullable=True)
    ims_rate = Column(Float, nullable=True)
    function_description = Column(String, nullable=True)
    section = Column(String, nullable=True)
    group_name = Column(String, nullable=True)

    # Registro del contrato
    contract_registry_number = Column(String, nullable=True)
    contract_registry_date = Column(Date, nullable=True)
    contract_registry_office = Column(String, nullable=True)
    contract_registry_status = Column(String, default="not_registered", nullable=True)

    # Cotización / RED simulado mínimo en contrato
    monthly_or_daily_contribution = Column(String, nullable=True)
    red_occupation_code = Column(String, nullable=True)
    red_reduction_code = Column(String, nullable=True)

    # Retribución
    salary_base = Column(Numeric(10, 2), nullable=True)
    pay_schedule = Column(String, default="not_prorated_14", nullable=False)
    gross_annual_salary = Column(Numeric(10, 2), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="contracts")
    company = relationship("Company", back_populates="contracts")
    work_center = relationship("WorkCenter", back_populates="contracts")
    collective_agreement = relationship("CollectiveAgreement")
    agreement_professional_category = relationship("ProfessionalCategory")
    salary_table_row = relationship("SalaryTableRow")
    incidents = relationship("Incident", back_populates="contract")
    payrolls = relationship("Payroll", back_populates="contract")
    payroll_concepts = relationship("ContractPayrollConcept", back_populates="contract")
    ss_registration = relationship(
        "SocialSecurityRegistration",
        back_populates="contract",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def employee_name(self):
        if not self.employee:
            return None
        return f"{self.employee.first_name} {self.employee.last_name}".strip()

    @property
    def company_name(self):
        if not self.company:
            return None
        return self.company.name

    @property
    def collective_agreement_name(self):
        if not self.collective_agreement:
            return None
        return self.collective_agreement.name
