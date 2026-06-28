from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import SessionLocal
from app.models.incident_calculation import PayrollSegment
from app.models.payroll import Payroll
from app.schemas.incident_payroll_engine import (
    IncidentPayrollPreviewResponse,
    IncidentPayrollProcessRequest,
    IncidentPayrollProcessResponse,
    PayrollSegmentResponse,
)
from app.services.incident_payroll_orchestrator import process_payroll_incidents
from app.services.incident_payroll_processor import period_incidents
from app.services.incident_segmenter import build_incident_segments


router = APIRouter(prefix="/payrolls", tags=["incident-payroll-engine"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/{payroll_id}/process-incidents",
    response_model=IncidentPayrollProcessResponse,
)
def process_incidents_endpoint(
    payroll_id: int,
    request: IncidentPayrollProcessRequest,
    db: Session = Depends(get_db),
):
    return process_payroll_incidents(db, payroll_id, actor=request.actor)


@router.get(
    "/{payroll_id}/incident-segments",
    response_model=list[PayrollSegmentResponse],
)
def incident_segments_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    if not db.query(Payroll.id).filter(Payroll.id == payroll_id).first():
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    return (
        db.query(PayrollSegment)
        .filter(PayrollSegment.payroll_id == payroll_id)
        .order_by(PayrollSegment.start_date, PayrollSegment.id)
        .all()
    )


@router.get(
    "/{payroll_id}/incident-preview",
    response_model=IncidentPayrollPreviewResponse,
)
def incident_preview_endpoint(payroll_id: int, db: Session = Depends(get_db)):
    payroll = (
        db.query(Payroll)
        .options(joinedload(Payroll.contract))
        .filter(Payroll.id == payroll_id)
        .first()
    )
    if not payroll:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if payroll.period_month not in range(1, 13):
        raise HTTPException(status_code=400, detail="La segmentación solo se aplica a nóminas mensuales")
    incidents = period_incidents(db, payroll)
    result = build_incident_segments(
        db,
        payroll.id,
        payroll.contract,
        payroll.period_month,
        payroll.period_year,
        incidents,
    )
    return {"payroll_id": payroll.id, **result}
