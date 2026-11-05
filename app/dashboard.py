from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .bookings import to_out
from .db import get_db
from .models import Booking, Employee
from .security import current_user

router = APIRouter(
    prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)]
)


@router.get("")
def dashboard(
    db: Session = Depends(get_db), user: Employee = Depends(current_user)
):
    today = date.today()
    stmt = select(Booking)
    if user.role != "admin":
        stmt = stmt.where(Booking.employee_id == user.id)
    bookings = list(db.scalars(stmt))
    outs = [to_out(b) for b in bookings]

    payments = []
    for b in bookings:
        for p in b.payments:
            if p.paid_date is None and p.due_date:
                payments.append(
                    {
                        "booking_id": b.id,
                        "payment_id": p.id,
                        "booking_no": b.booking_no,
                        "customer_name": b.customer_name,
                        "phone": b.phone,
                        "amount": p.amount if user.role == "admin" else None,
                        "due_date": p.due_date,
                        "late": p.due_date < today,
                    }
                )
    payments.sort(key=lambda x: x["due_date"])

    upcoming = sorted(
        (o for o in outs if o.trip_status == "upcoming"),
        key=lambda o: o.trip_start,
    )[:10]

    return {
        "total": len(outs),
        "in_progress": sum(o.trip_status == "in_progress" for o in outs),
        "upcoming": sum(o.trip_status == "upcoming" for o in outs),
        "due": sum(not p["late"] for p in payments),
        "late": sum(p["late"] for p in payments),
        "upcoming_trips": [
            {
                "id": o.id,
                "booking_no": o.booking_no,
                "customer_name": o.customer_name,
                "destination": o.destination,
                "trip_start": o.trip_start,
                "days_left": (o.trip_start - today).days,
                "starts_soon": o.starts_soon,
            }
            for o in upcoming
        ],
        "payments": payments,
    }