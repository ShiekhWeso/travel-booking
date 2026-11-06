import { useEffect, useState } from "react";
import { api } from "./api";
import MonthlyReport from "./MonthlyReport";

export default function Dashboard({ isAdmin }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    api("/dashboard").then(setD).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function pay(p) {
    await api(`/bookings/${p.booking_id}/payments/${p.payment_id}/pay`, {
      method: "POST",
    });
    load();
  }

  if (error) return <p className="err">{error}</p>;
  if (!d) return <div className="card">جاري التحميل...</div>;

  const stat = (n, label, color) => (
    <div className="card stat">
      <b style={color ? { color } : undefined}>{n}</b>
      <span>{label}</span>
    </div>
  );

  const soon = (n) =>
    n === 0 ? "اليوم" : n === 1 ? "غدًا" : n === 2 ? "بعد يومين" : `بعد ${n} أيام`;

  return (
    <>
      <div className="grid">
        {stat(d.total, "إجمالي الحجوزات")}
        {stat(d.in_progress, "رحلات قيد المعالجة")}
        {stat(d.upcoming, "رحلات قادمة")}
        {stat(d.due, "دفعات مستحقة", "var(--am)")}
        {stat(d.late, "دفعات متأخرة", "var(--rd)")}
      </div>

      <div className="card">
        <h3>الرحلات القادمة</h3>
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>العميل</th><th>الوجهة</th><th>تاريخ السفر</th><th>المدة المتبقية</th>
              </tr>
            </thead>
            <tbody>
              {d.upcoming_trips.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.customer_name}
                    {t.starts_soon && (
                      <span className="b soon">{soon(t.days_left)}</span>
                    )}
                  </td>
                  <td>{t.destination}</td>
                  <td>{t.trip_start}</td>
                  <td>{t.days_left} يوم</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>الدفعات المستحقة والمتأخرة</h3>
        {d.payments.length === 0 ? (
          <p style={{ color: "var(--mu)" }}>لا توجد دفعات مستحقة أو متأخرة!</p>
        ) : (
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  {isAdmin && <th>المبلغ</th>}
                  <th>الاستحقاق</th>
                  <th>الحالة</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td>{p.customer_name}</td>
                    <td>{p.phone}</td>
                    {isAdmin && <td>${Number(p.amount)}</td>}
                    <td>{p.due_date}</td>
                    <td>
                      <span className={`b ${p.late ? "late" : "partial"}`}>
                        {p.late ? "متأخر" : "مستحق"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <button className="sm" onClick={() => pay(p)}>تم السداد</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isAdmin && <MonthlyReport />}
    </>
  );
}