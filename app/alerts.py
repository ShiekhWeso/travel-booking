from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import AlertRead, Booking, Employee, Message, Reminder
from .security import current_user, require_admin

router = APIRouter(prefix="/alerts", tags=["alerts"])

URGENT_MINUTES = 180  # flight within 3 hours = urgent
AHEAD_DAYS = 3  # flights within 3 days show as info
KIND = {"international": "دولية", "domestic": "داخلية"}
ORDER = {"urgent": 0, "today": 1, "message": 2, "info": 3}


def after(minutes: int) -> str:
    if minutes < 60:
        return f"بعد {max(minutes, 1)} دقيقة"
    h = minutes // 60
    if h == 1:
        return "بعد ساعة"
    if h == 2:
        return "بعد ساعتين"
    return f"بعد {h} ساعات"


def in_days(d: int) -> str:
    if d == 1:
        return "غدًا"
    if d == 2:
        return "بعد يومين"
    return f"بعد {d} أيام"


def booking_info(b: Booking) -> dict:
    return {
        "booking_id": b.id,
        "booking_no": b.booking_no,
        "customer_name": b.customer_name,
    }


def flight_alerts(b: Booking, now: datetime) -> list[dict]:
    out = []
    for f in b.flights:
        for field, label, tag in (
            ("departs_at", "تقلع", "dep"),
            ("arrives_at", "تصل", "arr"),
        ):
            t = getattr(f, field)
            if t is None:
                continue
            t = t.replace(tzinfo=None)  # times are stored as office wall-clock
            if t < now:
                continue
            minutes = int((t - now).total_seconds() // 60)
            days = (t.date() - now.date()).days
            if minutes <= URGENT_MINUTES:
                level, when = "urgent", after(minutes)
            elif days == 0:
                level, when = "today", "اليوم"
            elif days <= AHEAD_DAYS:
                level, when = "info", in_days(days)
            else:
                continue
            extra = f" ({t:%Y-%m-%d})" if days else ""
            out.append(
                {
                    "key": f"{tag}:{f.id}:{level}:{t.isoformat()}",
                    "kind": "flight_departure" if tag == "dep" else "flight_arrival",
                    "level": level,
                    "title": f"رحلة {KIND.get(f.kind, '')} {label} {when}",
                    "text": f"{b.customer_name} - {b.destination} - {t:%H:%M}{extra}",
                    "when": t.isoformat(),
                    **booking_info(b),
                }
            )
    return out


@router.get("")
def list_alerts(
    db: Session = Depends(get_db), user: Employee = Depends(current_user)
):
    now = datetime.now(ZoneInfo(settings.timezone)).replace(tzinfo=None)
    today = now.date()
    is_admin = user.role == "admin"
    items: list[dict] = []

    # flights
    stmt = select(Booking).where(Booking.trip_end >= today - timedelta(days=3))
    if not is_admin:
        stmt = stmt.where(Booking.employee_id == user.id)
    for b in db.scalars(stmt):
        items += flight_alerts(b, now)

    # reminders due today or overdue
    rstmt = (
        select(Reminder, Booking)
        .join(Booking, Reminder.booking_id == Booking.id)
        .where(Reminder.done.is_(False), Reminder.remind_on <= today)
    )
    if not is_admin:
        rstmt = rstmt.where(Booking.employee_id == user.id)
    for r, b in db.execute(rstmt):
        overdue = r.remind_on < today
        items.append(
            {
                "key": f"rem:{r.id}:{'late' if overdue else 'today'}",
                "kind": "reminder",
                "level": "urgent" if overdue else "today",
                "title": "تذكير متأخر" if overdue else "تذكير لليوم",
                "text": f"{r.text} - {b.customer_name}",
                "when": r.remind_on.isoformat(),
                **booking_info(b),
            }
        )

    # messages from the admin (last 14 days)
    names = {e.id: e.name for e in db.scalars(select(Employee))}
    mstmt = select(Message).where(
        or_(Message.to_employee_id.is_(None), Message.to_employee_id == user.id),
        Message.created_at >= datetime.now(timezone.utc) - timedelta(days=14),
    )
    for m in db.scalars(mstmt):
        items.append(
            {
                "key": f"msg:{m.id}",
                "kind": "message",
                "level": "message",
                "title": f"رسالة من {names.get(m.created_by, 'الإدارة')}",
                "text": m.text,
                "when": m.created_at.isoformat(),
                "booking_id": None,
                "booking_no": None,
                "customer_name": None,
            }
        )

    read = set(
        db.scalars(select(AlertRead.alert_key).where(AlertRead.employee_id == user.id))
    )
    for i in items:
        i["read"] = i["key"] in read
    items.sort(key=lambda i: (ORDER[i["level"]], i["when"]))
    return {
        "unread": sum(not i["read"] for i in items),
        "items": items,
    }


class ReadIn(BaseModel):
    keys: list[str]


@router.post("/read")
def mark_read(
    data: ReadIn,
    db: Session = Depends(get_db),
    user: Employee = Depends(current_user),
):
    rows = [{"employee_id": user.id, "alert_key": k[:200]} for k in data.keys[:200]]
    if rows:
        db.execute(insert(AlertRead).values(rows).on_conflict_do_nothing())
        db.commit()
    return {"ok": True}


class MessageIn(BaseModel):
    to_employee_id: int | None = None  # empty = everyone
    text: str


@router.post("/messages")
def send_message(
    data: MessageIn,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    body = data.text.strip()
    if not body or len(body) > 500:
        raise HTTPException(422, "Message must be 1 to 500 characters")
    if data.to_employee_id and not db.get(Employee, data.to_employee_id):
        raise HTTPException(404, "Employee not found")
    db.add(Message(to_employee_id=data.to_employee_id, text=body, created_by=user.id))
    db.commit()
    return {"ok": True}