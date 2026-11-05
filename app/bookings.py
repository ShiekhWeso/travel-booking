from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast, extract, or_, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Booking, Employee, Flight, Payment
from .schemas import BookingIn, BookingList, BookingOut, PaymentIn
from .security import current_user, require_admin

router = APIRouter(
    prefix="/bookings", tags=["bookings"], dependencies=[Depends(current_user)]
)

def is_admin(user: Employee) -> bool:
    return user.role == "admin"

def own_or_404(db: Session, booking_id: int, user: Employee) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or (not is_admin(user) and booking.employee_id != user.id):
        raise HTTPException(404, "Booking not found")
    return booking

def to_out(b: Booking, user: Employee | None = None) -> BookingOut:
    today = date.today()
    paid = sum((p.amount for p in b.payments if p.paid_date), Decimal(0))

    if today < b.trip_start:
        trip_status = "upcoming"
    elif today <= b.trip_end:
        trip_status = "in_progress"
    else:
        trip_status = "completed"

    overdue = any(
        p.paid_date is None and p.due_date and p.due_date < today
        for p in b.payments
    )
    if overdue:
        payment_status = "late"
    elif paid == 0:
        payment_status = "unpaid"
    elif paid < b.sale_price:
        payment_status = "partial"
    else:
        payment_status = "paid"

    out = BookingOut.model_validate(b)
    
    result = out.model_copy(
        update={
            "paid": paid,
            "remaining": b.sale_price - paid,
            "expected_profit": b.sale_price - b.total_cost,
            "trip_status": trip_status,
            "starts_soon": today < b.trip_start
            and (b.trip_start - today).days <= 3,
            "payment_status": payment_status,
        }
    )
    if user is not None and not is_admin(user):
        result = result.model_copy(
            update={
                "total_cost": None,
                "sale_price": None,
                "invoice_note": None,
                "payments": [],
                "paid": None,
                "remaining": None,
                "expected_profit": None,
            }
        )
    return result


@router.post("", response_model=BookingOut)
def create_booking(
    data: BookingIn,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    if not is_admin(user):
        data.employee_id = user.id
        data.total_cost = Decimal(0)
        data.sale_price = Decimal(0)
        data.invoice_note = None
        data.payments = []
        
    if data.trip_end < data.trip_start:
        raise HTTPException(422, "trip_end must be after trip_start")
    fields = data.model_dump(exclude={"flights", "payments", "employee_id"})
    booking = Booking(
        **fields,
        employee_id=data.employee_id or user.id,
        flights=[Flight(**f.model_dump()) for f in data.flights],
        payments=[Payment(**p.model_dump()) for p in data.payments],
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return to_out(booking, user)

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    return to_out(own_or_404(db, booking_id, user), user)

@router.get("", response_model=BookingList)
def list_bookings(
    q: str | None = None,
    month: int | None = None,
    year: int | None = None,
    employee_id: int | None = None,
    status: str | None = None,
    payment_status: str | None = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    stmt = select(Booking).order_by(Booking.trip_start.desc())
    
    if not is_admin(user):
        stmt = stmt.where(Booking.employee_id == user.id)
    
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Booking.customer_name.ilike(like),
                Booking.phone.ilike(like),
                Booking.destination.ilike(like),
                Booking.passport_no.ilike(like),
                cast(Booking.booking_no, String).ilike(like),
            )
        )
    if month:
        stmt = stmt.where(extract("month", Booking.trip_start) == month)
    if year:
        stmt = stmt.where(extract("year", Booking.trip_start) == year)
    if employee_id:
        stmt = stmt.where(Booking.employee_id == employee_id)

    items = [to_out(b, user) for b in db.scalars(stmt)]
    if status:
        items = [i for i in items if i.trip_status == status]
    if payment_status:
        items = [i for i in items if i.payment_status == payment_status]
    return BookingList(count=len(items), items=items)

@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    data: BookingIn,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    booking = own_or_404(db, booking_id, user)
    if data.trip_end < data.trip_start:
        raise HTTPException(422, "trip_end must be after trip_start")
    fields = data.model_dump(exclude={"flights", "payments", "employee_id"})
    if not is_admin(user):
        for k in ("total_cost", "sale_price", "invoice_note"):
            fields.pop(k)
    for key, value in fields.items():
        setattr(booking, key, value)
    if is_admin(user):
        if data.employee_id:
            booking.employee_id = data.employee_id
        booking.payments = [Payment(**p.model_dump()) for p in data.payments]
    booking.flights = [Flight(**f.model_dump()) for f in data.flights]
    db.commit()
    db.refresh(booking)
    return to_out(booking, user)


@router.delete("/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db), user: Employee = Depends(require_admin),):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(404, "Booking not found")
    db.delete(booking)
    db.commit()
    return {"deleted": booking_id}


@router.post("/{booking_id}/payments", response_model=BookingOut)
def add_payment(
    booking_id: int, data: PaymentIn, db: Session = Depends(get_db),
    user: Employee = Depends(require_admin)
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(404, "Booking not found")
    booking.payments.append(Payment(**data.model_dump()))
    db.commit()
    db.refresh(booking)
    return to_out(booking, user)


@router.post("/{booking_id}/payments/{payment_id}/pay", response_model=BookingOut)
def mark_paid(
    booking_id: int,
    payment_id: int,
    paid_date: date | None = None,
    method: str | None = None,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin)
):
    payment = db.get(Payment, payment_id)
    if not payment or payment.booking_id != booking_id:
        raise HTTPException(404, "Payment not found")
    payment.paid_date = paid_date or date.today()
    if method:
        payment.method = method
    db.commit()
    booking = db.get(Booking, booking_id)
    db.refresh(booking)
    return to_out(booking, user)