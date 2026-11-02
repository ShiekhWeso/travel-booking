from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee
from .security import current_user

router = APIRouter(
    prefix="/employees", tags=["employees"], dependencies=[Depends(current_user)]
)


@router.get("")
def list_employees(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Employee).where(Employee.is_active).order_by(Employee.name)
    )
    return [{"id": e.id, "name": e.name} for e in rows]