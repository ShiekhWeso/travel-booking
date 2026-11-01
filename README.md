# Travel Booking

Booking management system for a travel office. Arabic UI (RTL), works on mobile and desktop.

## Features
- Single-page booking form (travelers, destination, services, flights, invoice note)
- Multiple payments per booking with due dates; paid, remaining and expected profit calculated automatically
- Trip status (upcoming / in progress / completed) and payment status (unpaid / partial / paid / late) computed from dates
- Bookings table with search (booking no., name, phone, destination, passport, status)
- Filters by month (trip start date) and by employee, with counts
- Dashboard: current and upcoming trips, due and overdue payments
- Planned: WhatsApp reminders (separate phase)

## Stack
FastAPI, PostgreSQL, React

## Setup
1. Copy `.env.example` to `.env` and fill in the values
2. Create the database and run `db/schema.sql`
3. Backend: `pip install -r requirements.txt` then `uvicorn app.main:app --reload`
4. Frontend: `cd frontend && npm install && npm run dev`

## Structure
- `app/` backend
- `frontend/` React app
- `db/schema.sql` database schema