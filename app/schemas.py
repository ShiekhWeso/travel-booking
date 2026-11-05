from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PaymentIn(BaseModel):
    amount: Decimal
    due_date: date | None = None
    paid_date: date | None = None
    method: str | None = None


class PaymentOut(PaymentIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class FlightIn(BaseModel):
    kind: str  # international or domestic
    departs_at: datetime | None = None
    details: str | None = None


class FlightOut(FlightIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class BookingIn(BaseModel):
    customer_name: str
    phone: str
    passport_no: str | None = None
    travelers_count: int = 1
    other_travelers: str | None = None
    destination: str
    trip_start: date
    trip_end: date
    services: list[str] = []
    total_cost: Decimal = Decimal(0)
    sale_price: Decimal = Decimal(0)
    invoice_note: str | None = None
    notes: str | None = None
    extra: dict = {}
    employee_id: int | None = None
    flights: list[FlightIn] = []
    payments: list[PaymentIn] = []


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_no: int
    created_at: datetime
    employee_id: int | None
    customer_name: str
    phone: str
    passport_no: str | None
    travelers_count: int
    other_travelers: str | None
    destination: str
    trip_start: date
    trip_end: date
    services: list[str]
    total_cost: Decimal | None
    sale_price: Decimal | None
    invoice_note: str | None
    notes: str | None
    extra: dict
    flights: list[FlightOut]
    payments: list[PaymentOut]
    # calculated automatically
    paid: Decimal | None = None
    remaining: Decimal | None = None
    expected_profit: Decimal | None = None
    trip_status: str = ""
    starts_soon: bool = False
    payment_status: str = ""
    
class BookingList(BaseModel):
    count: int
    items: list[BookingOut]