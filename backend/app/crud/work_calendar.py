from sqlalchemy.orm import Session

from app.models.work_calendar import WorkCalendar
from app.schemas.work_calendar import WorkCalendarCreate, WorkCalendarUpdate


def create_work_calendar(db: Session, calendar: WorkCalendarCreate):
    item = WorkCalendar(**calendar.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_work_calendars(db: Session):
    return db.query(WorkCalendar).filter(WorkCalendar.is_active == True).order_by(WorkCalendar.name.asc()).all()


def get_work_calendar(db: Session, calendar_id: int):
    return db.query(WorkCalendar).filter(WorkCalendar.id == calendar_id).first()


def get_work_calendar_by_name(db: Session, name: str):
    return db.query(WorkCalendar).filter(WorkCalendar.name == name).first()


def update_work_calendar(db: Session, calendar_id: int, calendar_data: WorkCalendarUpdate):
    item = get_work_calendar(db, calendar_id)
    if not item:
        return None
    for key, value in calendar_data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item
