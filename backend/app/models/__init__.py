import app.incident_payroll_schema_patch  # noqa: F401

from app.models.user import User
from app.models.employee import Employee
from app.models.contract import Contract
from app.models.social_security_registration import SocialSecurityRegistration
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.models.work_calendar import WorkCalendar
from app.models.incident import Incident
from app.models.incident_detail import IncidentAudit, IncidentConfirmation, IncidentDetail
from app.models.incident_calculation import IncidentCalculationRule, PayrollSegment
from app.models.incident_advanced import IncidentRegularization, VacationLedgerEntry
from app.models.wage_garnishment import WageGarnishment
from app.models.wage_garnishment_movement import WageGarnishmentMovement
from app.models.smi_parameter import SmiParameter
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import ContractPayrollConcept, PayrollConcept, PayrollItem
from app.models.document import Document
from app.models.employee_assignment_history import EmployeeAssignmentHistory
from app.models.tax_profile import TaxProfile
from app.models.case_study import CaseStudy, CaseTask
from app.models.correction import Correction
from app.models.student import Student
from app.models.student_group import StudentGroup
from app.models.case_assignment import CaseAssignment
from app.models.agreement_extra_pay import AgreementExtraPay, AgreementExtraPayConcept
from app.models.agreement_seniority import AgreementSeniorityRule
from app.models.agreement_parameterization import (
    AgreementConceptCatalog,
    AgreementRuleDetail,
    AgreementRuleHeader,
    AgreementSalaryConcept,
)
from app.models.collective_agreement import (
    AgreementComplement,
    CollectiveAgreement,
    LeaveRule,
    ProfessionalCategory,
    ProfessionalGroup,
    SalaryTable,
    SalaryTableRow,
    VacationRule,
    WorkTimeRule,
)
from app.services.advanced_incident_engine import install_advanced_incident_engine
from app.services.payroll_incident_bridge import install_payroll_incident_bridge

install_advanced_incident_engine()
install_payroll_incident_bridge()
