import app.incident_payroll_schema_patch  # noqa: F401
import app.payroll_stability_schema_patch  # noqa: F401

from app.models.user import User
from app.models.communication_file import CommunicationFile, CommunicationFileEvent
from app.models.communication_submission import CommunicationSubmission
from app.models.social_security_settlement import (
    SocialSecuritySettlement,
    SocialSecuritySettlementLine,
)
from app.models.employee import Employee
from app.models.contract import Contract
from app.models.social_security_registration import SocialSecurityRegistration
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.models.work_calendar import WorkCalendar
from app.models.incident import Incident
from app.models.incident_detail import IncidentAudit, IncidentConfirmation, IncidentDetail
from app.models.incident_calculation import IncidentCalculationRule, PayrollSegment
from app.models.wage_garnishment import WageGarnishment
from app.models.payroll import Payroll
from app.models.collective_agreement import (
    CollectiveAgreement,
    CollectiveAgreementVersion,
    ExtraPayRule,
    SeniorityRule,
    WorkingTimeRule,
)
from app.models.professional_category import ProfessionalCategory
from app.models.salary_table import SalaryTable, SalaryTableRow
from app.models.payroll_concept import PayrollConcept
from app.models.payroll_salary_structure import (
    ContractSalaryStructure,
    PayrollItem,
    PermanentPayrollItem,
)
from app.models.irpf_calculation import IrpfCalculation
from app.models.employee_irpf_profile import EmployeeIrpfProfile
from app.models.smi_parameter import SmiParameter
from app.models.document import Document
from app.models.alert import Alert
from app.models.case_study import CaseStudy, CaseStudyAssignment, CaseStudyCorrection
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.class_group import ClassGroup
from app.models.student_progress import StudentProgress
from app.models.student_notification import StudentNotification
from app.models.assignment import Assignment
from app.models.correction import Correction
from app.models.audit_log import AuditLog
