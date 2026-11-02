from fastapi import APIRouter, Depends
from sqlalchemy import and_, extract, func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Booking, Employee
from .security import current_user

router = APIRouter(
    prefix="/stats", tags=["stats"], dependencies=[Depends(current_user)]
)


@router.get("/monthly")
def monthly(
    month: int | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
):
    conds = []
    if month:
        conds.append(extract("month", Booking.trip_start) == month)
    if year:
        conds.append(extract("year", Booking.trip_start) == year)

    rows = db.execute(
        select(Employee.id, Employee.name, func.count(Booking.id))
        .outerjoin(Booking, and_(Booking.employee_id == Employee.id, *conds))
        .where(Employee.is_active)
        .group_by(Employee.id, Employee.name)
        .order_by(Employee.name)
    ).all()

    total = db.scalar(select(func.count(Booking.id)).where(*conds))
    return {
        "total": total,
        "by_employee": [{"id": r[0], "name": r[1], "count": r[2]} for r in rows],
    }