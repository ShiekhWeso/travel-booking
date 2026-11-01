from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_db
from .auth import router as auth_router
from .bookings import router as bookings_router

app = FastAPI(title="Travel Booking")
app.include_router(auth_router)
app.include_router(bookings_router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}