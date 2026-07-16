from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

import app.models  # noqa: F401 - registra todas las tablas de la aplicación
from app.db import Base
from app.models.company import Company


def _company_dependent_tables():
    """Return every table that depends directly or transitively on companies."""

    company_table = Base.metadata.tables[Company.__tablename__]
    affected = {company_table}

    while True:
        discovered = {
            table
            for table in Base.metadata.tables.values()
            if table not in affected
            and any(foreign_key.column.table in affected for foreign_key in table.foreign_keys)
        }
        if not discovered:
            return affected
        affected.update(discovered)


def clear_company_workspace(db: Session) -> dict[str, object]:
    """Delete all companies and every dependent business record.

    PostgreSQL uses TRUNCATE ... CASCADE so database constraints determine the
    complete deletion graph and all affected identities are restarted. SQLite
    and other test databases use SQLAlchemy's reverse dependency order.

    Static catalogues without a dependency on companies, such as system payroll
    concepts and collective-agreement templates, are preserved.
    """

    affected_tables = _company_dependent_tables()
    company_count = db.execute(select(func.count()).select_from(Company)).scalar_one()
    dialect_name = db.get_bind().dialect.name

    try:
        if dialect_name == "postgresql":
            db.execute(text('TRUNCATE TABLE "companies" RESTART IDENTITY CASCADE'))
        else:
            for table in reversed(Base.metadata.sorted_tables):
                if table in affected_tables:
                    db.execute(table.delete())
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "companies_deleted": int(company_count or 0),
        "tables_cleared": sorted(table.name for table in affected_tables),
        "database_dialect": dialect_name,
    }
