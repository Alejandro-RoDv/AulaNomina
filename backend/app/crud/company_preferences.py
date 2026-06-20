import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.company_preferences import CompanyPreferences
from app.schemas.company_preferences import CompanyPreferencesPayload


CONFIG_FIELDS = {
    "general": "general_config",
    "contribution": "contribution_config",
    "withholding": "withholding_config",
    "payroll": "payroll_config",
    "documents": "documents_config",
    "corporate_identity": "corporate_identity_config",
    "language": "language_config",
}


def _dump(value: dict[str, Any]) -> str:
    return json.dumps(value or {}, ensure_ascii=False)


def _load(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def get_company_preferences(db: Session, company_id: int) -> CompanyPreferences | None:
    return (
        db.query(CompanyPreferences)
        .filter(CompanyPreferences.company_id == company_id)
        .first()
    )


def create_default_company_preferences(db: Session, company_id: int) -> CompanyPreferences:
    preferences = CompanyPreferences(company_id=company_id)
    db.add(preferences)
    db.commit()
    db.refresh(preferences)
    return preferences


def upsert_company_preferences(
    db: Session,
    company_id: int,
    payload: CompanyPreferencesPayload,
) -> CompanyPreferences:
    preferences = get_company_preferences(db, company_id)
    if not preferences:
        preferences = CompanyPreferences(company_id=company_id)
        db.add(preferences)

    for payload_key, model_field in CONFIG_FIELDS.items():
        setattr(preferences, model_field, _dump(getattr(payload, payload_key)))

    preferences.inherited_from_company_id = payload.inherited_from_company_id
    preferences.effective_from = payload.effective_from
    preferences.updated_by = payload.updated_by
    preferences.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(preferences)
    return preferences


def serialize_company_preferences(preferences: CompanyPreferences) -> dict[str, Any]:
    result: dict[str, Any] = {
        "id": preferences.id,
        "company_id": preferences.company_id,
        "schema_version": preferences.schema_version,
        "inherited_from_company_id": preferences.inherited_from_company_id,
        "effective_from": preferences.effective_from,
        "updated_by": preferences.updated_by,
        "updated_at": preferences.updated_at,
    }
    for payload_key, model_field in CONFIG_FIELDS.items():
        result[payload_key] = _load(getattr(preferences, model_field))
    return result
