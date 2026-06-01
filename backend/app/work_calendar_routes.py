from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.crud.work_calendar import (
    create_work_calendar,
    get_work_calendar,
    get_work_calendar_by_name,
    get_work_calendars,
    update_work_calendar,
)
from app.schemas.work_calendar import WorkCalendarCreate, WorkCalendarResponse, WorkCalendarUpdate

router = APIRouter(prefix="/work-calendars", tags=["work-calendars"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=list[WorkCalendarResponse])
def list_work_calendars(db: Session = Depends(get_db)):
    return get_work_calendars(db)


@router.post("", response_model=WorkCalendarResponse)
def create_work_calendar_endpoint(calendar: WorkCalendarCreate, db: Session = Depends(get_db)):
    existing_calendar = get_work_calendar_by_name(db, calendar.name)
    if existing_calendar:
        raise HTTPException(status_code=400, detail="Ya existe un calendario con ese nombre")
    return create_work_calendar(db, calendar)


@router.put("/{calendar_id}", response_model=WorkCalendarResponse)
def update_work_calendar_endpoint(calendar_id: int, calendar: WorkCalendarUpdate, db: Session = Depends(get_db)):
    updated_calendar = update_work_calendar(db, calendar_id, calendar)
    if not updated_calendar:
        raise HTTPException(status_code=404, detail="Calendario no encontrado")
    return updated_calendar


@router.get("/{calendar_id}", response_model=WorkCalendarResponse)
def get_work_calendar_endpoint(calendar_id: int, db: Session = Depends(get_db)):
    calendar = get_work_calendar(db, calendar_id)
    if not calendar:
        raise HTTPException(status_code=404, detail="Calendario no encontrado")
    return calendar
