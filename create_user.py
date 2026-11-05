from getpass import getpass

from app.db import SessionLocal
from app.models import Employee
from app.security import hash_password

name = input("Name: ")
email = input("Email: ")
role = input("Role (admin/employee) [employee]: ") or "employee"
password = getpass("Password: ")

with SessionLocal() as db:
    db.add(Employee(name=name, email=email, role=role, password_hash=hash_password(password)))
    db.commit()
print("Created:", email)