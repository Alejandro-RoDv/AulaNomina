from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base
from app.models.company import Company
from app.models.employee import Employee
from app.services.model190_demo_safe_service import (
    get_model190_demo_status,
    seed_model190_demo,
)


def build_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine, sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_demo_uses_company_scoped_code_when_legacy_code_is_already_taken():
    engine, db = build_session()
    try:
        original_company = Company(name="Empresa demo anterior", cif="B19010001")
        target_company = Company(name="Empresa destino", cif="B19010002")
        db.add_all([original_company, target_company])
        db.flush()
        db.add(
            Employee(
                employee_code="M190-DEMO-ANA",
                company_id=original_company.id,
                dni="99999999R",
                first_name="Trabajadora",
                last_name="Existente",
            )
        )
        db.commit()

        result = seed_model190_demo(db, target_company.id)

        assert result["prepared"] is True
        assert result["stage"] == "needs_correction"
        target_workers = (
            db.query(Employee)
            .filter(
                Employee.company_id == target_company.id,
                Employee.dni.in_(("30000001A", "30000002B", "30000003C")),
            )
            .order_by(Employee.dni)
            .all()
        )
        assert len(target_workers) == 3

        ana = next(item for item in target_workers if item.dni == "30000001A")
        assert ana.employee_code != "M190-DEMO-ANA"
        assert ana.employee_code.startswith(f"M190-DEMO-ANA-C{target_company.id}")

        counts_before = db.query(Employee).count()
        repeated = seed_model190_demo(db, target_company.id)
        assert repeated["stage"] == "needs_correction"
        assert db.query(Employee).count() == counts_before

        status = get_model190_demo_status(db, target_company.id)
        assert status["prepared"] is True
        assert status["stage"] == "needs_correction"
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
