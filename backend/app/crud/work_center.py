from sqlalchemy.orm import Session

from app.models.work_center import WorkCenter
from app.schemas.work_center import WorkCenterCreate, WorkCenterUpdate


def create_work_center(db: Session, work_center: WorkCenterCreate):
    db_work_center = WorkCenter(**work_center.model_dump())
    db.add(db_work_center)
    db.commit()
    db.refresh(db_work_center)
    return db_work_center


def get_work_centers(db: Session, include_inactive: bool = False):
    query = db.query(WorkCenter)
    if not include_inactive:
        query = query.filter(WorkCenter.is_active == True)
    return query.all()


def get_work_centers_all(db: Session):
    return db.query(WorkCenter).all()


def get_work_centers_by_company(db: Session, company_id: int):
    return (
        db.query(WorkCenter)
        .filter(
            WorkCenter.company_id == company_id,
            WorkCenter.is_active == True,
        )
        .all()
    )


def get_work_center(db: Session, work_center_id: int):
    return db.query(WorkCenter).filter(WorkCenter.id == work_center_id).first()


def get_work_center_by_code(db: Session, center_code: str):
    return (
        db.query(WorkCenter)
        .filter(WorkCenter.center_code == center_code)
        .first()
    )


def update_work_center(
    db: Session,
    work_center_id: int,
    work_center_data: WorkCenterUpdate,
):
    db_work_center = get_work_center(db, work_center_id)

    if not db_work_center:
        return None

    update_data = work_center_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_work_center, key, value)

    db.commit()
    db.refresh(db_work_center)

    return db_work_center


def soft_delete_work_center(db: Session, work_center_id: int):
    db_work_center = get_work_center(db, work_center_id)

    if not db_work_center:
        return None

    db_work_center.is_active = False

    db.commit()
    db.refresh(db_work_center)

    return db_work_center
