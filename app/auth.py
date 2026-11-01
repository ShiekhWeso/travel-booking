from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee
from .security import create_token, current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    employee = db.scalar(select(Employee).where(Employee.email == form.username))
    if (
        not employee
        or not employee.is_active
        or not verify_password(form.password, employee.password_hash)
    ):
        raise HTTPException(401, "Wrong email or password")
    return {"access_token": create_token(employee.id), "token_type": "bearer"}


@router.get("/me")
def me(user: Employee = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email}