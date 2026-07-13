from fastapi import APIRouter

from app.catalogs.contract_codes import CONTRACT_CODES
from app.catalogs.contribution_groups import CONTRIBUTION_GROUPS
from app.catalogs.red_catalogs import (
    INACTIVITY_TYPES,
    MONTHLY_DAILY_CONTRIBUTION_TYPES,
    SITUATION_CODES,
    SOCIAL_EXCLUSION_VICTIM_STATUSES,
    SUBSTITUTION_CAUSES,
    UNEMPLOYED_CONDITIONS,
    WORKER_COLLECTIVES,
    WORKING_DAY_TYPES,
)
from app.communication_file_routes import router as communication_file_router
from app.social_security_registration_routes import router as social_security_registration_router
from app.wage_garnishment_routes import router as wage_garnishment_router

router = APIRouter(tags=["catalogs"])
router.include_router(communication_file_router)
router.include_router(social_security_registration_router)
router.include_router(wage_garnishment_router)


def sort_contract_codes(codes):
    return sorted(codes, key=lambda item: int(item.get("contract_code") or 0))


@router.get("/catalogs/contracts")
def get_contract_codes():
    return sort_contract_codes(CONTRACT_CODES)


@router.get("/catalogs/contribution-groups")
def get_contribution_groups():
    return CONTRIBUTION_GROUPS


@router.get("/catalogs/situations")
def get_situation_codes():
    return SITUATION_CODES


@router.get("/catalogs/unemployed-conditions")
def get_unemployed_conditions():
    return UNEMPLOYED_CONDITIONS


@router.get("/catalogs/substitution-causes")
def get_substitution_causes():
    return SUBSTITUTION_CAUSES


@router.get("/catalogs/inactivity-types")
def get_inactivity_types():
    return INACTIVITY_TYPES


@router.get("/catalogs/worker-collectives")
def get_worker_collectives():
    return WORKER_COLLECTIVES


@router.get("/catalogs/social-exclusion-victim-statuses")
def get_social_exclusion_victim_statuses():
    return SOCIAL_EXCLUSION_VICTIM_STATUSES


@router.get("/catalogs/working-day-types")
def get_working_day_types():
    return WORKING_DAY_TYPES


@router.get("/catalogs/monthly-daily-contribution-types")
def get_monthly_daily_contribution_types():
    return MONTHLY_DAILY_CONTRIBUTION_TYPES


@router.get("/catalogs/all")
def get_all_catalogs():
    return {
        "contracts": sort_contract_codes(CONTRACT_CODES),
        "contribution_groups": CONTRIBUTION_GROUPS,
        "situations": SITUATION_CODES,
        "unemployed_conditions": UNEMPLOYED_CONDITIONS,
        "substitution_causes": SUBSTITUTION_CAUSES,
        "inactivity_types": INACTIVITY_TYPES,
        "worker_collectives": WORKER_COLLECTIVES,
        "social_exclusion_victim_statuses": SOCIAL_EXCLUSION_VICTIM_STATUSES,
        "working_day_types": WORKING_DAY_TYPES,
        "monthly_daily_contribution_types": MONTHLY_DAILY_CONTRIBUTION_TYPES,
    }
