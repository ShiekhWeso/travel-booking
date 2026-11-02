import { useEffect, useState } from "react";
import { api } from "./api";
import { TRIP, PAY, MONTHS } from "./constants";


export default function Bookings({onEdit}) {
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState({ count: 0, items: [] });
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/employees").then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (month) params.set("month", month);
    if (employee) params.set("employee_id", employee);
    if (status) params.set("status", status);
    const t = setTimeout(() => {
      api("/bookings?" + params)
        .then((d) => { setData(d); setError(""); })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q, month, employee, status]);

  return (
    <div className="card">
      <div className="bar">
        <input
          placeholder="بحث: رقم الحجز، الاسم، الهاتف، الوجهة، رقم الجواز"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">كل الأشهر</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="">كل الموظفين</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(TRIP).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <p className="err">{error}</p>}
      <p style={{ color: "var(--mu)", margin: "0 0 10px" }}>
        عدد الحجوزات: <b style={{ color: "var(--tx)" }}>{data.count}</b>
      </p>

      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>رقم</th><th>العميل</th><th>الوجهة</th><th>الرحلة</th>
              <th>الحالة</th><th>المتبقي</th><th>الدفع</th><th>الفاتورة</th><th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b.id}>
                <td>#{b.booking_no}</td>
                <td>
                  {b.customer_name}
                  {b.starts_soon && <span className="b soon">قريب</span>}
                </td>
                <td>{b.destination}</td>
                <td>{b.trip_start} ← {b.trip_end}</td>
                <td><span className={`b ${b.trip_status}`}>{TRIP[b.trip_status]}</span></td>
                <td>${Number(b.remaining)}</td>
                <td><span className={`b ${b.payment_status}`}>{PAY[b.payment_status]}</span></td>
                <td>
                  <button className="sm" onClick={() => setInvoice(b)}>عرض</button>
                </td>
                <td>
                  <button className="sm" onClick={() => onEdit(b)}>تعديل</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice && (
        <div className="modal" onClick={() => setInvoice(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h3>فاتورة الحجز #{invoice.booking_no}</h3>
            <p className="pre">{invoice.invoice_note || "لا توجد فاتورة مكتوبة لهذا الحجز."}</p>
            <button className="btn" onClick={() => setInvoice(null)}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}