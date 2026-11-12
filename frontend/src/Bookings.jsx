import { useEffect, useState } from "react";
import { api } from "./api";
import { TRIP, PAY, MONTHS } from "./constants";

export default function Bookings({ onEdit, isAdmin }) {
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState({ count: 0, items: [] });
  const [stats, setStats] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState(null);

  function fmtDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  }

  useEffect(() => {
    if (isAdmin) api("/employees").then(setEmployees).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (employee) params.set("employee_id", employee);
    if (status) params.set("status", status);

    const sp = new URLSearchParams();
    if (month) sp.set("month", month);
    if (year) sp.set("year", year);
    api("/stats/monthly?" + sp).then(setStats).catch(() => {});

    const t = setTimeout(() => {
      api("/bookings?" + params)
        .then((d) => { setData(d); setError(""); })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q, month, year, employee, status, tick]);

  async function remove(b) {
    if (!window.confirm(`حذف الحجز #${b.booking_no} للعميل ${b.customer_name}؟ لا يمكن التراجع.`))
      return;
    try {
      await api(`/bookings/${b.id}`, { method: "DELETE" });
      setTick((t) => t + 1);
    } catch (e) {
      setError(e.message);
    }
  }

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
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">كل السنوات</option>
          {[1, 0, -1].map((d) => {
            const y = new Date().getFullYear() + d;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        {isAdmin && (
          <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">كل الموظفين</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(TRIP).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="chips">
          <span className="chip">الإجمالي: <b>{stats.total}</b></span>
          {stats.by_employee.map((e) => (
            <span className="chip" key={e.id}>{e.name}: <b>{e.count}</b></span>
          ))}
        </div>
      )}
      {error && <p className="err">{error}</p>}
      <p style={{ color: "var(--mu)", margin: "0 0 10px" }}>
        عدد الحجوزات: <b style={{ color: "var(--tx)" }}>{data.count}</b>
      </p>

      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>رقم</th>
              <th>العميل</th>
              <th>تاريخ إنشاء الحجز</th>
              <th>الوجهة</th>
              <th>الرحلة</th>
              <th>الحالة</th>
              {isAdmin && <th>المتبقي</th>}
              <th>الدفع</th>
              {isAdmin && <th>الفاتورة</th>}
              <th></th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b.id}>
                <td>#{b.booking_no}</td>
                <td>
                  {b.customer_name}
                  {b.starts_soon && <span className="b soon">قريب</span>}
                  {b.notes &&(
                    <button className="flag" title="ملاحظة" onClick={() => setNote(b)}>
                      <img src="/alert.png" alt="ملاحظة" />
                    </button>
                  )}
                </td>
                <td>{fmtDate(b.created_at)}</td>
                <td>{b.destination}</td>
                <td>{b.trip_start} ← {b.trip_end}</td>
                <td><span className={`b ${b.trip_status}`}>{TRIP[b.trip_status]}</span></td>
                {isAdmin && <td>${Number(b.remaining)}</td>}
                <td><span className={`b ${b.payment_status}`}>{PAY[b.payment_status]}</span></td>
                {isAdmin && (
                  <td>
                    <button className="sm" onClick={() => setInvoice(b)}>عرض</button>
                  </td>
                )}
                <td>
                  <button className="sm" onClick={() => onEdit(b)}>تعديل</button>
                </td>
                {isAdmin && (
                  <td>
                    <button className="sm danger" onClick={() => remove(b)}>حذف</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice && (
        <div className="modal" onClick={() => setInvoice(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h3>فاتورة الحجز #{invoice.booking_no}</h3>
            <p className="pre">
              {invoice.invoice_note || "لا توجد فاتورة مكتوبة لهذا الحجز."}
            </p>
            <button className="btn" onClick={() => setInvoice(null)}>إغلاق</button>
          </div>
        </div>
      )}

      {note && (
        <div className="modal" onClick={() => setNote(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h3>ملاحظة الحجز #{note.booking_no}</h3>
            <p className="pre">{note.notes}</p>
            <button className="btn" onClick={() => setNote(null)}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}