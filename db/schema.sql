-- PostgreSQL schema: travel booking system

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE SEQUENCE booking_no_seq START 1001;

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  booking_no INT NOT NULL UNIQUE DEFAULT nextval('booking_no_seq'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  employee_id INT REFERENCES employees(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  passport_no TEXT,
  travelers_count INT NOT NULL DEFAULT 1,
  other_travelers TEXT,
  destination TEXT NOT NULL,
  trip_start DATE NOT NULL,
  trip_end DATE NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',   -- flight, hotel, visa, events, package
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_note TEXT,
  notes TEXT,
  extra JSONB NOT NULL DEFAULT '{}',        -- future fields without migrations
  CHECK (trip_end >= trip_start)
);

CREATE TABLE flights (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('international','domestic')),
  departs_at TIMESTAMPTZ,
  details TEXT
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE,
  paid_date DATE,                           -- NULL = not paid yet
  method TEXT
);

CREATE TABLE field_defs (                   -- optional: custom fields later
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','number','date'))
);

CREATE INDEX ON bookings (passport_no);
CREATE INDEX ON bookings (phone);
CREATE INDEX ON bookings (trip_start);
CREATE INDEX ON payments (booking_id, due_date);

-- Statuses are computed, never stored
CREATE VIEW booking_overview AS
SELECT b.*,
  COALESCE(p.paid,0) AS paid,
  b.sale_price - COALESCE(p.paid,0) AS remaining,
  b.sale_price - b.total_cost AS expected_profit,
  CASE WHEN CURRENT_DATE < b.trip_start THEN 'upcoming'
       WHEN CURRENT_DATE <= b.trip_end THEN 'in_progress'
       ELSE 'completed' END AS trip_status,
  (CURRENT_DATE < b.trip_start AND b.trip_start - CURRENT_DATE <= 3) AS starts_soon,
  CASE WHEN COALESCE(p.overdue,0) > 0 THEN 'late'
       WHEN COALESCE(p.paid,0) = 0 THEN 'unpaid'
       WHEN COALESCE(p.paid,0) < b.sale_price THEN 'partial'
       ELSE 'paid' END AS payment_status
FROM bookings b
LEFT JOIN (
  SELECT booking_id,
    SUM(amount) FILTER (WHERE paid_date IS NOT NULL) AS paid,
    COUNT(*) FILTER (WHERE paid_date IS NULL AND due_date < CURRENT_DATE) AS overdue
  FROM payments GROUP BY booking_id
) p ON p.booking_id = b.id;
