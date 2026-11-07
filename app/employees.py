from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee
from .security import current_user, hash_password, require_admin

router = APIRouter(
    prefix="/employees", tags=["employees"], dependencies=[Depends(current_user)]
)

ROLES = ("admin", "employee")


class EmployeeCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "employee"


class EmployeeUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None


class PasswordReset(BaseModel):
    password: str


# ---------- helpers ----------
def _out(e: Employee) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "email": e.email,
        "role": e.role,
        "is_active": e.is_active,
    }


def _clean_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email or " " in email or len(email) < 5:
        raise HTTPException(422, "البريد الإلكتروني غير صحيح")
    return email


def _check_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(422, "كلمة المرور يجب ألا تقل عن 8 أحرف")


def _email_taken(db: Session, email: str, exclude_id: int | None = None) -> bool:
    q = select(Employee.id).where(func.lower(Employee.email) == email)
    if exclude_id:
        q = q.where(Employee.id != exclude_id)
    return db.scalar(q) is not None


def _get(db: Session, employee_id: int) -> Employee:
    e = db.get(Employee, employee_id)
    if not e:
        raise HTTPException(404, "الموظف غير موجود")
    return e


def _owner_id(db: Session) -> int | None:
    """The main admin = the first admin account ever created."""
    return db.scalar(select(func.min(Employee.id)).where(Employee.role == "admin"))


def _guard(db: Session, actor: Employee, target: Employee) -> None:
    """Only the main admin can touch the main admin or other admins."""
    owner = _owner_id(db)
    if target.id == actor.id:
        return
    if target.id == owner:
        raise HTTPException(403, "لا يمكن تعديل حساب المدير الرئيسي")
    if target.role == "admin" and actor.id != owner:
        raise HTTPException(403, "فقط المدير الرئيسي يستطيع إدارة حسابات المديرين")


# ---------- used by the booking form dropdown (any logged-in user) ----------
@router.get("")
def list_employees(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Employee).where(Employee.is_active).order_by(Employee.name)
    )
    return [{"id": e.id, "name": e.name} for e in rows]


# ---------- admin management ----------
@router.get("/all")
def list_all_employees(
    db: Session = Depends(get_db), user: Employee = Depends(require_admin)
):
    owner = _owner_id(db)
    rows = db.scalars(select(Employee).order_by(Employee.is_active.desc(), Employee.name))
    return [{**_out(e), "is_owner": e.id == owner} for e in rows]


@router.post("")
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(422, "الاسم مطلوب")
    email = _clean_email(data.email)
    _check_password(data.password)
    if data.role not in ROLES:
        raise HTTPException(422, "الصلاحية غير صحيحة")
    if data.role == "admin" and user.id != _owner_id(db):
        raise HTTPException(403, "فقط المدير الرئيسي يستطيع إضافة مدير")
    if _email_taken(db, email):
        raise HTTPException(409, "هذا البريد الإلكتروني مستخدم بالفعل")
    e = Employee(
        name=name,
        email=email,
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _out(e)


@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    e = _get(db, employee_id)
    _guard(db, user, e)
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(422, "الاسم مطلوب")
        e.name = name
    if data.email is not None:
        email = _clean_email(data.email)
        if _email_taken(db, email, exclude_id=e.id):
            raise HTTPException(409, "هذا البريد الإلكتروني مستخدم بالفعل")
        e.email = email
    if data.role is not None and data.role != e.role:
        if data.role not in ROLES:
            raise HTTPException(422, "الصلاحية غير صحيحة")
        if e.id == user.id:
            raise HTTPException(400, "لا يمكنك تغيير صلاحيتك بنفسك")
        if user.id != _owner_id(db):
            raise HTTPException(403, "فقط المدير الرئيسي يستطيع تغيير الصلاحيات")
        e.role = data.role
    db.commit()
    db.refresh(e)
    return _out(e)


@router.put("/{employee_id}/password")
def reset_password(
    employee_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    e = _get(db, employee_id)
    _guard(db, user, e)
    _check_password(data.password)
    e.password_hash = hash_password(data.password)
    db.commit()
    return {"ok": True}


@router.post("/{employee_id}/deactivate")
def deactivate(
    employee_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    e = _get(db, employee_id)
    _guard(db, user, e)
    if e.id == user.id:
        raise HTTPException(400, "لا يمكنك إيقاف حسابك بنفسك")
    e.is_active = False
    db.commit()
    return _out(e)


@router.post("/{employee_id}/activate")
def activate(
    employee_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    e = _get(db, employee_id)
    _guard(db, user, e)
    e.is_active = True
    db.commit()
    return _out(e)


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: Employee = Depends(require_admin),
):
    e = _get(db, employee_id)
    _guard(db, user, e)
    if e.id == user.id:
        raise HTTPException(400, "لا يمكنك حذف حسابك بنفسك")
    try:
        db.delete(e)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "لا يمكن حذف موظف لديه حجوزات أو سجلات، قم بإيقافه بدلًا من ذلك"
        )
    return {"deleted": employee_id}