import { useEffect, useState } from "react";
import { api } from "./api";
import Reminders from "./Reminders";

const SERVICES = [
  ["flight", "طيران"], ["hotel", "فندق"], ["visa", "تأشيرة"],
  ["events", "تذاكر فعاليات"], ["package", "باقة سياحية كاملة"],
];

function initial(b, meId) {
  const fl = (k) => b?.flights.find((f) => f.kind === k);
  return {
    customer_name: b?.customer_name || "",
    phone: b?.phone || "",
    passport_no: b?.passport_no || "",
    employee_id: b?.employee_id || meId || "",
    other_travelers: b?.other_travelers || "",
    travelers_count: b?.travelers_count || 1,
    destination: b?.destination || "",
    trip_start: b?.trip_start || "",
    trip_end: b?.trip_end || "",
    services: b?.services || [],
    intl_at: fl("international")?.departs_at?.slice(0, 16) || "",
    intl_details: fl("international")?.details || "",
    intl_arr: fl("international")?.arrives_at?.slice(0, 16) || "",
    dom_at: fl("domestic")?.departs_at?.slice(0, 16) || "",
    dom_details: fl("domestic")?.details || "",
    dom_arr: fl("domestic")?.arrives_at?.slice(0, 16) || "",
    total_cost: b?.total_cost != null ? Number(b.total_cost) : "",
    sale_price: b?.sale_price != null ? Number(b.sale_price) : "",
    invoice_note: b?.invoice_note || "",
    notes: b?.notes || "",
    payments: (b?.payments || []).map((p) => ({
      amount: Number(p.amount),
      due_date: p.due_date || "",
      paid_date: p.paid_date || "",
      method: p.method || "",
    })),
  };
}

export default function BookingForm({ booking, onSaved, isAdmin, meId }) {
  const [f, setF] = useState(() => initial(booking, meId));
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (isAdmin) api("/employees").then(setEmployees).catch(() => {});
  }, [isAdmin]);

  const paid = f.payments.reduce(
    (s, p) => s + (p.paid_date ? Number(p.amount) || 0 : 0), 0);
  const remaining = (Number(f.sale_price) || 0) - paid;
  const profit = (Number(f.sale_price) || 0) - (Number(f.total_cost) || 0);

  function toggleService(k) {
    set("services", f.services.includes(k)
      ? f.services.filter((s) => s !== k)
      : [...f.services, k]);
  }

  function setPayment(i, k, v) {
    set("payments", f.payments.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    const flights = [];
    if (f.intl_at)
      flights.push({ kind: "international", departs_at: f.intl_at, arrives_at: f.intl_arr || null, details: f.intl_details || null });
    if (f.dom_at)
      flights.push({ kind: "domestic", departs_at: f.dom_at, arrives_at: f.dom_arr || null, details: f.dom_details || null });
    const body = {
      customer_name: f.customer_name,
      phone: f.phone,
      passport_no: f.passport_no || null,
      employee_id: f.employee_id ? Number(f.employee_id) : null,
      other_travelers: f.other_travelers || null,
      travelers_count: Number(f.travelers_count) || 1,
      destination: f.destination,
      trip_start: f.trip_start,
      trip_end: f.trip_end,
      services: f.services,
      total_cost: Number(f.total_cost) || 0,
      sale_price: Number(f.sale_price) || 0,
      invoice_note: f.invoice_note || null,
      notes: f.notes || null,
      flights,
      payments: f.payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({
          amount: Number(p.amount),
          due_date: p.due_date || null,
          paid_date: p.paid_date || null,
          method: p.method || null,
        })),
    };
    try {
      const saved = await api(booking ? `/bookings/${booking.id}` : "/bookings", {
        method: booking ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (!booking) {
        for (const r of pending) {
          await api("/reminders", {
            method: "POST",
            body: JSON.stringify({ booking_id: saved.id, ...r }),
          });
        }
      }
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const input = (label, k, type = "text", extra = {}) => (
    <div>
      <label>{label}</label>
      <input type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </div>
  );

  return (
    <>
      <div className="card">
        <h3>{booking ? `تعديل الحجز #${booking.booking_no}` : "بيانات الحجز"}</h3>
        <div className="f">
          {input("اسم المسافر الرئيسي", "customer_name")}
          {input("رقم الهاتف", "phone", "tel")}
          {input("رقم جواز السفر", "passport_no")}
          {isAdmin && (
            <div>
              <label>الموظف المسؤول</label>
              <select value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)}>
                {employees.length > 0 &&
                  f.employee_id &&
                  !employees.some((e) => e.id === Number(f.employee_id)) && (
                    <option value={f.employee_id}>موظف موقوف</option>
                  )}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>أسماء بقية المسافرين</label>
            <textarea rows="2" value={f.other_travelers}
              onChange={(e) => set("other_travelers", e.target.value)} />
          </div>
          {input("عدد المسافرين", "travelers_count", "number", { min: 1 })}
          {input("الوجهة السياحية", "destination")}
          {input("بداية الرحلة", "trip_start", "date")}
          {input("نهاية الرحلة", "trip_end", "date")}
        </div>
      </div>

      <div className="card">
        <h3>الخدمات</h3>
        <div className="chk">
          {SERVICES.map(([k, label]) => (
            <label key={k}>
              <input type="checkbox" checked={f.services.includes(k)}
                onChange={() => toggleService(k)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>مواعيد الطيران</h3>
        <div className="f">
          {input("الطيران الدولي: الإقلاع", "intl_at", "datetime-local")}
          {input("الطيران الدولي: الوصول", "intl_arr", "datetime-local")}
          {input("ملاحظات الرحلة الدولية", "intl_details")}
          {input("الطيران الداخلي: الإقلاع (إن وجد)", "dom_at", "datetime-local")}
          {input("الطيران الداخلي: الوصول", "dom_arr", "datetime-local")}
          {input("ملاحظات الرحلة الداخلية", "dom_details")}
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h3>المبالغ والدفعات</h3>
          <div className="f">
            {input("التكلفة الإجمالية", "total_cost", "number")}
            {input("سعر البيع للعميل", "sale_price", "number")}
          </div>
          <p style={{ color: "var(--mu)", fontSize: 13 }}>
            الدفعات (المبلغ، الاستحقاق، تاريخ السداد، الطريقة)
          </p>
          {f.payments.map((p, i) => (
            <div className="pay" key={i}>
              <input type="number" placeholder="المبلغ" value={p.amount}
                onChange={(e) => setPayment(i, "amount", e.target.value)} />
              <input type="date" title="الاستحقاق" value={p.due_date}
                onChange={(e) => setPayment(i, "due_date", e.target.value)} />
              <input type="date" title="تاريخ السداد" value={p.paid_date}
                onChange={(e) => setPayment(i, "paid_date", e.target.value)} />
              <input placeholder="الطريقة" value={p.method}
                onChange={(e) => setPayment(i, "method", e.target.value)} />
            </div>
          ))}
          <button className="sm" onClick={() =>
            set("payments", [...f.payments, { amount: "", due_date: "", paid_date: "", method: "" }])}>
            + إضافة دفعة
          </button>
          <p className="sum">
            <span>المدفوع: ${paid}</span>
            <span>المتبقي: ${remaining}</span>
            <span>الربح المتوقع: ${profit}</span>
          </p>
        </div>
      )}

      <div className="card">
        <h3>التذكيرات</h3>
        <Reminders bookingId={booking?.id} pending={pending} setPending={setPending} />
      </div>

      <div className="card">
        <h3>{isAdmin ? "الفاتورة والملاحظات" : "الملاحظات"}</h3>
        <div className="f">
          {isAdmin && (
            <div>
              <label>الفاتورة (تفاصيل التكاليف وترتيب الرحلة)</label>
              <textarea rows="4" value={f.invoice_note}
                onChange={(e) => set("invoice_note", e.target.value)} />
            </div>
          )}
          <div>
            <label>ملاحظات إضافية</label>
            <textarea rows="4" value={f.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <button className="btn" onClick={save} disabled={saving}>حفظ الحجز</button>
    </>
  );
}