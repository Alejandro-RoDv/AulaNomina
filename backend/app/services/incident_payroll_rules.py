from dataclasses import dataclass


@dataclass(frozen=True)
class IncidentPayrollRule:
    """Payroll effect rule for a simulated labour incident."""

    affects_payroll: bool
    reduces_worked_days: bool
    reduces_contribution_days: bool
    display_label: str


INCIDENT_PAYROLL_RULES: dict[str, IncidentPayrollRule] = {
    "IT": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Incapacidad temporal",
    ),
    "RECAIDA": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Recaída IT",
    ),
    "VACACIONES": IncidentPayrollRule(
        affects_payroll=False,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Vacaciones",
    ),
    "AUSENCIA": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=True,
        display_label="Ausencia no retribuida",
    ),
    "PERMISO_RETRIBUIDO": IncidentPayrollRule(
        affects_payroll=False,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Permiso retribuido",
    ),
    "PERMISO_NO_RETRIBUIDO": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=True,
        display_label="Permiso no retribuido",
    ),
    "COMMON_SICK_LEAVE": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="IT enfermedad común",
    ),
    "WORK_ACCIDENT": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Accidente laboral",
    ),
    "UNPAID_ABSENCE": IncidentPayrollRule(
        affects_payroll=True,
        reduces_worked_days=True,
        reduces_contribution_days=True,
        display_label="Ausencia no retribuida",
    ),
    "VACATION": IncidentPayrollRule(
        affects_payroll=False,
        reduces_worked_days=True,
        reduces_contribution_days=False,
        display_label="Vacaciones",
    ),
}


def resolve_incident_rule(incident_type: str) -> IncidentPayrollRule:
    """Return the payroll rule for an incident type.

    Unknown incident types are treated as informational so new incident types do
    not break payroll generation before their payroll rule is configured.
    """

    return INCIDENT_PAYROLL_RULES.get(
        incident_type,
        IncidentPayrollRule(
            affects_payroll=False,
            reduces_worked_days=False,
            reduces_contribution_days=False,
            display_label=incident_type,
        ),
    )
