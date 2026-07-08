from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class PayrollReceiptParty(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    tax_id: Optional[str] = None
    social_security_number: Optional[str] = None
    contribution_account: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None


class PayrollReceiptContract(BaseModel):
    id: int
    code: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    seniority_date: Optional[date] = None
    contribution_group: Optional[str] = None
    professional_category: Optional[str] = None
    job_position: Optional[str] = None
    collective_agreement: Optional[str] = None
    working_day_type: Optional[str] = None
    partiality_coefficient: Optional[Decimal] = None
    pay_schedule: Optional[str] = None


class PayrollReceiptPeriod(BaseModel):
    month: int
    year: int
    label: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    period_days: int = 30
    contribution_days: int = 30
    worked_days: int = 30
    incident_days: int = 0
    it_days: int = 0
    non_contribution_days: int = 0


class PayrollReceiptLine(BaseModel):
    id: Optional[int] = None
    code: str
    name: str
    description: Optional[str] = None
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    amount: Decimal = Decimal("0.00")
    concept_type: str
    salary_nature: str
    category: str = "OTRO"
    source_type: str = "system"
    display_order: int = 0
    taxable: bool = False
    contribution_base: bool = False
    affects_gross: bool = False
    affects_net: bool = False
    formula: Optional[str] = None
    trace: dict = Field(default_factory=dict)


class PayrollReceiptBases(BaseModel):
    common_contingencies: Decimal = Decimal("0.00")
    professional_contingencies: Decimal = Decimal("0.00")
    unemployment_training_fogasa: Decimal = Decimal("0.00")
    irpf: Decimal = Decimal("0.00")
    daily_common_base: Decimal = Decimal("0.00")
    daily_professional_base: Decimal = Decimal("0.00")


class PayrollReceiptBaseExplanation(BaseModel):
    code: str
    title: str
    amount: Decimal = Decimal("0.00")
    formula: str
    affected_by_incident: bool = False
    explanation: str
    learning_points: list[str] = Field(default_factory=list)


class PayrollReceiptDeductions(BaseModel):
    employee_common_contingencies: Decimal = Decimal("0.00")
    employee_unemployment: Decimal = Decimal("0.00")
    employee_training: Decimal = Decimal("0.00")
    employee_mei: Decimal = Decimal("0.00")
    employee_social_security: Decimal = Decimal("0.00")
    irpf_percentage: Decimal = Decimal("0.00")
    irpf: Decimal = Decimal("0.00")
    total_deductions: Decimal = Decimal("0.00")


class PayrollReceiptCompanyCost(BaseModel):
    company_common_contingencies: Decimal = Decimal("0.00")
    company_unemployment: Decimal = Decimal("0.00")
    company_fogasa: Decimal = Decimal("0.00")
    company_training: Decimal = Decimal("0.00")
    company_at_ep: Decimal = Decimal("0.00")
    company_mei: Decimal = Decimal("0.00")
    company_total_social_security: Decimal = Decimal("0.00")
    company_total_cost: Decimal = Decimal("0.00")


class PayrollReceiptTotals(BaseModel):
    total_earnings: Decimal = Decimal("0.00")
    total_deductions: Decimal = Decimal("0.00")
    net_salary: Decimal = Decimal("0.00")
    company_total_cost: Decimal = Decimal("0.00")
    concept_earnings: Decimal = Decimal("0.00")
    concept_deductions: Decimal = Decimal("0.00")
    concept_net_salary: Decimal = Decimal("0.00")


class PayrollReceiptIncidentSegment(BaseModel):
    id: int
    incident_id: Optional[int] = None
    segment_type: str
    start_date: date
    end_date: date
    calendar_days: int
    payroll_days: Decimal
    salary_percentage: Decimal = Decimal("0.00")
    benefit_percentage: Decimal = Decimal("0.00")
    complement_percentage: Decimal = Decimal("0.00")
    contribution_treatment: str
    salary_amount: Decimal = Decimal("0.00")
    benefit_amount: Decimal = Decimal("0.00")
    complement_amount: Decimal = Decimal("0.00")
    deduction_amount: Decimal = Decimal("0.00")


class PayrollReceiptAffectedConcept(BaseModel):
    code: str
    name: str
    amount: Decimal = Decimal("0.00")
    concept_type: str


class PayrollReceiptIncidentExplanation(BaseModel):
    id: int
    incident_id: Optional[int] = None
    segment_type: str
    title: str
    period: str
    calendar_days: int = 0
    payroll_days: Decimal = Decimal("0.00")
    salary_amount: Decimal = Decimal("0.00")
    benefit_amount: Decimal = Decimal("0.00")
    complement_amount: Decimal = Decimal("0.00")
    deduction_amount: Decimal = Decimal("0.00")
    net_effect: Decimal = Decimal("0.00")
    contribution_treatment: Optional[str] = None
    explanation: str
    learning_points: list[str] = Field(default_factory=list)
    affected_concepts: list[PayrollReceiptAffectedConcept] = Field(default_factory=list)


class PayrollReceiptIncidentSummary(BaseModel):
    has_incidents: bool = False
    incident_days: int = 0
    it_days: int = 0
    non_contribution_days: int = 0
    total_benefits: Decimal = Decimal("0.00")
    total_company_complements: Decimal = Decimal("0.00")
    total_absence_deductions: Decimal = Decimal("0.00")
    total_net_incident_effect: Decimal = Decimal("0.00")
    explanation: str


class PayrollReceiptResponse(BaseModel):
    payroll_id: int
    payroll_code: str
    status: str
    generated_at: datetime
    is_simulated: bool = True
    company: PayrollReceiptParty
    work_center: Optional[PayrollReceiptParty] = None
    employee: PayrollReceiptParty
    contract: PayrollReceiptContract
    period: PayrollReceiptPeriod
    earnings: list[PayrollReceiptLine] = Field(default_factory=list)
    deductions: list[PayrollReceiptLine] = Field(default_factory=list)
    bases: PayrollReceiptBases
    base_lines: list[PayrollReceiptLine] = Field(default_factory=list)
    base_explanations: list[PayrollReceiptBaseExplanation] = Field(default_factory=list)
    company_cost: PayrollReceiptCompanyCost
    company_cost_lines: list[PayrollReceiptLine] = Field(default_factory=list)
    informative_lines: list[PayrollReceiptLine] = Field(default_factory=list)
    incident_segments: list[PayrollReceiptIncidentSegment] = Field(default_factory=list)
    incident_summary: PayrollReceiptIncidentSummary
    incident_explanations: list[PayrollReceiptIncidentExplanation] = Field(default_factory=list)
    deduction_summary: PayrollReceiptDeductions
    totals: PayrollReceiptTotals
    legal_footer: str
    warnings: list[str] = Field(default_factory=list)
