from collections import defaultdict
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from .bookings import to_out  # reuse the same money logic as the dashboard
from .db import get_db
from .models import Booking, Employee
from .security import require_admin

router = APIRouter(
    prefix="/reports", tags=["reports"], dependencies=[Depends(require_admin)]
)

MONTHS_AR = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
PAYMENT_AR = {
    "paid": "مدفوع",
    "partial": "مدفوع جزئيًا",
    "unpaid": "غير مدفوع",
    "late": "متأخر",
}
TRIP_AR = {"upcoming": "قادمة", "in_progress": "جارية", "completed": "منتهية"}

MONEY = '"$"#,##0.00'
DATE = "yyyy-mm-dd"
HEADER_FILL = PatternFill("solid", fgColor="2F8F9D")
HEADER_FONT = Font(bold=True, color="FFFFFF")
TOTAL_FILL = PatternFill("solid", fgColor="E6F2F4")
LATE_FILL = PatternFill("solid", fgColor="FDE2E2")
THIN = Side(style="thin", color="D0D5DD")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center")


def _f(x) -> float:
    return float(x or 0)


def _autowidth(ws):
    for col in ws.columns:
        longest = max((len(str(c.value)) for c in col if c.value is not None), default=8)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(
            max(longest + 4, 12), 40
        )


def _write_table(ws, headers, rows, money_cols=(), date_cols=(), total_cols=()):
    """Header on row 1, data below, optional totals row. Columns are 0-based."""
    ws.sheet_view.rightToLeft = True
    ws.append(headers)
    for cell in ws[1]:
        cell.fill, cell.font, cell.alignment, cell.border = (
            HEADER_FILL, HEADER_FONT, CENTER, BORDER,
        )
    for r in rows:
        ws.append(r)
    last = ws.max_row
    for row in ws.iter_rows(min_row=2, max_row=last):
        for i, cell in enumerate(row):
            cell.border, cell.alignment = BORDER, CENTER
            if i in money_cols:
                cell.number_format = MONEY
            if i in date_cols:
                cell.number_format = DATE
    if rows and total_cols:
        totals = [""] * len(headers)
        totals[0] = "الإجمالي"
        for i in total_cols:
            totals[i] = sum(_f(r[i]) for r in rows)
        ws.append(totals)
        for i, cell in enumerate(ws[ws.max_row]):
            cell.font, cell.fill = Font(bold=True), TOTAL_FILL
            cell.border, cell.alignment = BORDER, CENTER
            if i in money_cols:
                cell.number_format = MONEY
    ws.freeze_panes = "A2"
    _autowidth(ws)


@router.get("/monthly.xlsx")
def monthly_report(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2000, le=2100),
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    # Month is decided by travel date (trip_start), same as the rest of the app
    bookings = db.scalars(
        select(Booking)
        .where(
            extract("month", Booking.trip_start) == month,
            extract("year", Booking.trip_start) == year,
        )
        .order_by(Booking.trip_start, Booking.booking_no)
    ).all()
    items = [(b, to_out(b, user)) for b in bookings]

    employees = {e.id: e for e in db.scalars(select(Employee))}

    def emp_name(b):
        e = employees.get(b.employee_id)
        return e.name if e else "غير محدد"

    # ---------- Summary ----------
    wb = Workbook()
    ws = wb.active
    ws.title = "الملخص"
    ws.sheet_view.rightToLeft = True

    sale = sum(_f(b.sale_price) for b, _ in items)
    cost = sum(_f(b.total_cost) for b, _ in items)
    paid = sum(_f(o.paid) for _, o in items)
    remaining = sum(_f(o.remaining) for _, o in items)
    status_count = defaultdict(int)
    for _, o in items:
        status_count[o.payment_status] += 1
    intl = sum(1 for b, _ in items if any(f.kind == "international" for f in b.flights))
    dom = sum(1 for b, _ in items if any(f.kind == "domestic" for f in b.flights))

    ws["A1"] = f"تقرير شهر {MONTHS_AR[month - 1]} {year}"
    ws["A1"].font = Font(bold=True, size=14)
    ws.merge_cells("A1:B1")
    ws["A1"].alignment = CENTER

    summary = [
        ("عدد الحجوزات", len(items), None),
        ("عدد العملاء", len({b.phone for b, _ in items}), None),
        ("عدد المسافرين", sum(b.travelers_count for b, _ in items), None),
        ("إجمالي المبيعات", sale, MONEY),
        ("إجمالي التكلفة", cost, MONEY),
        ("المدفوع", paid, MONEY),
        ("المتبقي", remaining, MONEY),
        ("الربح المتوقع", sale - cost, MONEY),
        ("حجوزات مدفوعة بالكامل", status_count["paid"], None),
        ("حجوزات مدفوعة جزئيًا", status_count["partial"], None),
        ("حجوزات غير مدفوعة", status_count["unpaid"], None),
        ("حجوزات بها دفعات متأخرة", status_count["late"], None),
        ("حجوزات بها رحلات دولية", intl, None),
        ("حجوزات بها رحلات داخلية", dom, None),
    ]
    for i, (label, value, fmt) in enumerate(summary, start=3):
        a, b_ = ws.cell(i, 1, label), ws.cell(i, 2, value)
        a.font, a.fill = Font(bold=True), TOTAL_FILL
        for c in (a, b_):
            c.border, c.alignment = BORDER, CENTER
        if fmt:
            b_.number_format = fmt
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 20

    # ---------- Per employee ----------
    per = defaultdict(lambda: [0, 0, 0.0, 0.0, 0.0, 0.0, 0.0])
    for e in employees.values():
        if e.is_active:
            per[e.id]  # make sure active employees show up even with 0 bookings
    for b, o in items:
        p = per[b.employee_id]
        p[0] += 1
        p[1] += b.travelers_count
        p[2] += _f(b.sale_price)
        p[3] += _f(b.total_cost)
        p[4] += _f(o.paid)
        p[5] += _f(o.remaining)
        p[6] += _f(b.sale_price) - _f(b.total_cost)
    emp_rows = []
    for eid, p in per.items():
        e = employees.get(eid)
        emp_rows.append([e.name if e else "غير محدد", *p])
    emp_rows.sort(key=lambda r: (-r[1], r[0]))
    _write_table(
        wb.create_sheet("حجوزات الموظفين"),
        ["الموظف", "عدد الحجوزات", "عدد المسافرين", "المبيعات", "التكلفة",
         "المدفوع", "المتبقي", "الربح المتوقع"],
        emp_rows,
        money_cols={3, 4, 5, 6, 7},
        total_cols=(1, 2, 3, 4, 5, 6, 7),
    )

    # ---------- Details ----------
    detail_rows = []
    for b, o in items:
        detail_rows.append([
            b.booking_no, emp_name(b), b.customer_name, b.phone, b.destination,
            b.trip_start, b.trip_end, b.travelers_count,
            _f(b.sale_price), _f(b.total_cost), _f(o.paid), _f(o.remaining),
            _f(b.sale_price) - _f(b.total_cost),
            PAYMENT_AR.get(o.payment_status, o.payment_status),
            TRIP_AR.get(o.trip_status, o.trip_status),
            "نعم" if b.notes else "",
        ])
    wd = wb.create_sheet("تفاصيل الحجوزات")
    _write_table(
        wd,
        ["رقم الحجز", "الموظف", "العميل", "الهاتف", "الوجهة", "تاريخ السفر",
         "تاريخ العودة", "المسافرون", "سعر البيع", "التكلفة", "المدفوع",
         "المتبقي", "الربح المتوقع", "حالة الدفع", "حالة الرحلة", "ملاحظات"],
        detail_rows,
        money_cols={8, 9, 10, 11, 12},
        date_cols={5, 6},
        total_cols=(7, 8, 9, 10, 11, 12),
    )
    if detail_rows:
        wd.auto_filter.ref = f"A1:P{len(detail_rows) + 1}"
        for row in wd.iter_rows(min_row=2, max_row=len(detail_rows) + 1):
            if row[13].value == PAYMENT_AR["late"]:
                row[13].fill = LATE_FILL

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="report-{year}-{month:02d}.xlsx"'
        },
    )
