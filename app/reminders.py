from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .bookings import own_or_404
from .db import get_db
from .models import Employee, Reminder
from .security import current_user

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderIn(BaseModel):
    booking_id: int
    remind_on: date
    text: str


def to_dict(r: Reminder) -> dict:
    return {
        "id": r.id,
        "booking_id": r.booking_id,
        "remind_on": r.remind_on,
        "text": r.text,
        "done": r.done,
    }


def own_reminder(db: Session, reminder_id: int, user: Employee) -> Reminder:
    r = db.get(Reminder, reminder_id)
    if not r:
        raise HTTPException(404, "Reminder not found")
    own_or_404(db, r.booking_id, user)
    return r


@router.get("")
def list_reminders(
    booking_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    own_or_404(db, booking_id, user)
    rows = db.scalars(
        select(Reminder)
        .where(Reminder.booking_id == booking_id)
        .order_by(Reminder.remind_on)
    )
    return [to_dict(r) for r in rows]


@router.post("")
def add_reminder(
    data: ReminderIn,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    own_or_404(db, data.booking_id, user)
    body = data.text.strip()
    if not body or len(body) > 300:
        raise HTTPException(422, "Text must be 1 to 300 characters")
    r = Reminder(
        booking_id=data.booking_id,
        remind_on=data.remind_on,
        text=body,
        created_by=user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return to_dict(r)


@router.post("/{reminder_id}/done")
def set_done(
    reminder_id: int,
    done: bool = True,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    r = own_reminder(db, reminder_id, user)
    r.done = done
    db.commit()
    return to_dict(r)


@router.delete("/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    db.delete(own_reminder(db, reminder_id, user))
    db.commit()
    return {"deleted": reminder_id}