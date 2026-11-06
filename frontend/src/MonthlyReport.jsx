import { useState } from "react";
import { download } from "./api";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function MonthlyReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setBusy(true);
    setError("");
    try {
      await download(
        `/reports/monthly.xlsx?month=${month}&year=${year}`,
        `تقرير-${year}-${String(month).padStart(2, "0")}.xlsx`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>التقرير الشهري (Excel)</h3>
      <p style={{ color: "var(--mu)", marginTop: 0 }}>
        يعتمد الشهر على تاريخ السفر، ويتضمن الملخص وحجوزات كل موظف وتفاصيل الحجوزات.
      </p>
      <div className="bar">
        <div>
          <label>الشهر</label>
          <select value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label>السنة</label>
          <input
            type="number"
            value={year}
            min="2000"
            max="2100"
            onChange={(e) => setYear(+e.target.value)}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button className="btn" onClick={handleDownload} disabled={busy}>
            {busy ? "جاري التحميل..." : "تحميل التقرير"}
          </button>
        </div>
      </div>
      {error && <p className="err">{error}</p>}
    </div>
  );
}