from app.services.fie_service import payroll_impact_for_statuses, reconciliation_decision


def test_sick_leave_without_internal_incident_proposes_creation():
    result = reconciliation_decision("SICK_LEAVE", incident_exists=False)

    assert result["status"] == "PENDING_REVIEW"
    assert result["recommended_action"] == "CREATE_INCIDENT"


def test_sick_leave_with_matching_date_is_conciliated():
    result = reconciliation_decision(
        "SICK_LEAVE",
        incident_exists=True,
        exact_start_match=True,
    )

    assert result["status"] == "MATCHED"
    assert result["recommended_action"] == "LINK_INCIDENT"


def test_confirmation_without_process_is_an_error():
    result = reconciliation_decision("CONFIRMATION", incident_exists=False)

    assert result["status"] == "ERROR"
    assert result["recommended_action"] == "LOCATE_INCIDENT"


def test_medical_discharge_closes_an_open_process():
    result = reconciliation_decision(
        "MEDICAL_DISCHARGE",
        incident_exists=True,
        same_discharge_date=False,
    )

    assert result["status"] == "PENDING_REVIEW"
    assert result["recommended_action"] == "CLOSE_INCIDENT"


def test_relapse_without_previous_process_is_a_discrepancy():
    result = reconciliation_decision(
        "RELAPSE",
        incident_exists=False,
        previous_process_exists=False,
    )

    assert result["status"] == "DISCREPANCY"
    assert result["recommended_action"] == "SELECT_PREVIOUS_PROCESS"


def test_payroll_impact_distinguishes_recalculation_and_regularization():
    assert payroll_impact_for_statuses([]) == "NO_IMPACT"
    assert payroll_impact_for_statuses(["draft"]) == "PENDING_RECALCULATION"
    assert payroll_impact_for_statuses(["calculated"]) == "PENDING_RECALCULATION"
    assert payroll_impact_for_statuses(["paid"]) == "REGULARIZATION_REQUIRED"
    assert payroll_impact_for_statuses(["closed", "draft"]) == "REGULARIZATION_REQUIRED"
