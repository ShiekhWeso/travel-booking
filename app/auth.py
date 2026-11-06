from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee
from .security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    email = form.username.strip().lower()
    employee = db.scalar(select(Employee).where(func.lower(Employee.email) == email))
    if (
        not employee
        or not employee.is_active
        or not verify_password(form.password, employee.password_hash)
    ):
        raise HTTPException(401, "Wrong email or password")
    return {"access_token": create_token(employee.id), "token_type": "bearer"}


@router.get("/me")
def me(user: Employee = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


@router.post("/change-password")
def change_password(
    data: PasswordChange,
    user: Employee = Depends(current_user),
    db: Session = Depends(get_db),
):
    # 400 (not 401) on purpose: the frontend logs the user out on any 401
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "كلمة المرور الحالية غير صحيحة")
    if len(data.new_password) < 8:
        raise HTTPException(422, "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}