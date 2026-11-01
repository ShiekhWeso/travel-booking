from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import ARRAY, ForeignKey, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    is_active: Mapped[bool] = mapped_column(default=True)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_no: Mapped[int] = mapped_column(
        server_default=text("nextval('booking_no_seq')")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"))
    customer_name: Mapped[str]
    phone: Mapped[str]
    passport_no: Mapped[str | None]
    travelers_count: Mapped[int] = mapped_column(default=1)
    other_travelers: Mapped[str | None] = mapped_column(Text)
    destination: Mapped[str]
    trip_start: Mapped[date]
    trip_end: Mapped[date]
    services: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    invoice_note: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)

    flights: Mapped[list["Flight"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    payments: Mapped[list["Payment"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE")
    )
    kind: Mapped[str]
    departs_at: Mapped[datetime | None]
    details: Mapped[str | None] = mapped_column(Text)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date | None]
    paid_date: Mapped[date | None]
    method: Mapped[str | None]