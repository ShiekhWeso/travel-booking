from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .auth import router as auth_router
from .bookings import router as bookings_router

from fastapi.middleware.cors import CORSMiddleware
from .employees import router as employees_router
from .dashboard import router as dashboard_router
from .stats import router as stats_router

app = FastAPI(title="Travel Booking")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(employees_router)
app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(dashboard_router)
app.include_router(stats_router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}