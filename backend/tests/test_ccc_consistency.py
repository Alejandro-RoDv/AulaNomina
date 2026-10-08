from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.crud.company import create_company, update_company
from app.crud.work_center import create_work_center, update_work_center
from app.db import Base
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.schemas.work_center import WorkCenterCreate, WorkCenterUpdate
from app.services.ccc_service import canonical_ccc, ccc_parts, compose_ccc, same_ccc
from app.services.training_foundation_review_service import _review_a02
from app.services.training_validation_feedback import enrich_validation_result
from app.training.foundation_runtime_cases_2026 import (
    FOUNDATION_CENTER_ADDRESS,
    FOUNDATION_CENTER_CODE,
    FOUNDATION_CENTER_EMAIL,
    FOUNDATION_CENTER_EXPECTED_CCC,
    FOUNDATION_CENTER_NAME,
    FOUNDATION_CENTER_PHONE,
    FOUNDATION_COMPANY_ADDRESS,
    FOUNDATION_COMPANY_CCC,
    FOUNDATION_COMPANY_CIF,
    FOUNDATION_COMPANY_EMAIL,
    FOUNDATION_COMPANY_NAME,
    FOUNDATION_COMPANY_PHONE,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_ccc_accepts_legacy_and_always_builds_regime_plus_code():
    assert ccc_parts("14149990011") == ("0111", "14149990011")
    assert canonical_ccc("0111 14149990011") == "0111/14149990011"
    assert same_ccc("14149990011", "0111/14149990011")
    assert compose_ccc("0111", "14149990011") == "0111/14149990011"

    with pytest.raises(ValueError, match="4 dígitos"):
        compose_ccc("11", "14149990011")
    with pytest.raises(ValueError, match="11 dígitos"):
        compose_ccc("0111", "123")


def test_legacy_company_response_exposes_split_fields_without_changing_its_wire_value():
    response = CompanyResponse(
        id=1,
        name="Empresa antigua",
        cif="B00000002",
        ccc="14149990001",
        is_active=True,
        created_at=datetime(2026, 1, 1),
    )
    assert response.ccc == "14149990001"
    assert response.ccc_regime == "0111"
    assert response.ccc_code == "14149990001"


def test_company_ccc_is_copied_to_centers_and_stays_synchronized(db):
    company = create_company(
        db,
        CompanyCreate(
            name="Empresa de prueba",
            cif="B00000001",
            ccc_regime="0111",
            ccc_code="14149990001",
        ),
    )
    center = create_work_center(
        db,
        WorkCenterCreate(
            company_id=company.id,
            center_code="1.1",
            name="Centro de prueba",
            general_ccc="9999/99999999999",
            main_ccc="0111/14149990011",
        ),
    )
    assert center.general_ccc == "0111/14149990001"

    update_company(db, company.id, CompanyUpdate(ccc_regime="0121", ccc_code="14149990002"))
    db.refresh(center)
    assert center.general_ccc == "0121/14149990002"

    update_work_center(db, center.id, WorkCenterUpdate(general_ccc="9999/99999999999"))
    db.refresh(center)
    assert center.general_ccc == "0121/14149990002"


def test_all_activity_results_receive_specific_issues():
    result = enrich_validation_result(
        {
            "passed": False,
            "checks": [
                {
                    "passed": False,
                    "supported": True,
                    "message": "Revisa el cálculo.",
                    "evidence": {"ccc_ok": False, "date_ok": False, "total_ok": True},
                }
            ],
        }
    )
    assert result["checks"][0]["issues"] == ["Revisa el CCC.", "Revisa la fecha."]
    assert result["issues"] == ["Revisa el CCC.", "Revisa la fecha."]


def test_explicit_validator_issues_take_priority():
    result = enrich_validation_result(
        {
            "checks": [
                {
                    "passed": False,
                    "supported": True,
                    "message": "Mensaje general.",
                    "evidence": {"issues": ["El régimen debe ser 0111."], "ccc_ok": False},
                }
            ]
        }
    )
    assert result["issues"] == ["El régimen debe ser 0111."]


def test_a02_validator_explains_the_exact_ccc_error(db):
    company = create_company(
        db,
        CompanyCreate(
            name=FOUNDATION_COMPANY_NAME,
            cif=FOUNDATION_COMPANY_CIF,
            ccc=FOUNDATION_COMPANY_CCC,
            address=FOUNDATION_COMPANY_ADDRESS,
            city="Córdoba",
            company_email=FOUNDATION_COMPANY_EMAIL,
            company_phone=FOUNDATION_COMPANY_PHONE,
        ),
    )
    create_work_center(
        db,
        WorkCenterCreate(
            company_id=company.id,
            center_code=FOUNDATION_CENTER_CODE,
            name=FOUNDATION_CENTER_NAME,
            main_ccc="0111/14149990012",
            address=FOUNDATION_CENTER_ADDRESS,
            city="Córdoba",
            email=FOUNDATION_CENTER_EMAIL,
            phone=FOUNDATION_CENTER_PHONE,
        ),
    )

    review = _review_a02(db)

    assert review["passed"] is False
    assert review["evidence"]["center_main_ccc_ok"] is False
    assert review["evidence"]["issues"] == [
        f"El CCC propio del centro debe tener régimen 0111 y código 14149990011; ahora figura 0111/14149990012."
    ]
    assert FOUNDATION_CENTER_EXPECTED_CCC == "0111/14149990011"


def test_a02_validates_existing_center_with_different_internal_code(db):
    company = create_company(
        db,
        CompanyCreate(
            name=FOUNDATION_COMPANY_NAME,
            cif=FOUNDATION_COMPANY_CIF,
            ccc=FOUNDATION_COMPANY_CCC,
            address=FOUNDATION_COMPANY_ADDRESS,
            city="Córdoba",
            company_email=FOUNDATION_COMPANY_EMAIL,
            company_phone=FOUNDATION_COMPANY_PHONE,
        ),
    )
    create_work_center(
        db,
        WorkCenterCreate(
            company_id=company.id,
            center_code="CENTRO-REAL",
            name=FOUNDATION_CENTER_NAME,
            main_ccc=FOUNDATION_CENTER_EXPECTED_CCC,
            address=FOUNDATION_CENTER_ADDRESS,
            city="Córdoba",
            email=FOUNDATION_CENTER_EMAIL,
            phone=FOUNDATION_CENTER_PHONE,
        ),
    )

    review = _review_a02(db)

    assert review["passed"] is True
    assert review["evidence"]["center_main_ccc_ok"] is True
    assert review["evidence"]["issues"] == []
