import { useState } from "react";
import { api } from "./api";

export default function ChangePassword({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف");
    if (next !== again) return setError("كلمتا المرور غير متطابقتين");
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <h3>تغيير كلمة المرور</h3>
        {done ? (
          <>
            <p style={{ color: "var(--gr)", fontWeight: 700 }}>تم تغيير كلمة المرور بنجاح.</p>
            <button className="btn" onClick={onClose}>إغلاق</button>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <div>
              <label>كلمة المرور الحالية</label>
              <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label>كلمة المرور الجديدة</label>
              <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div>
              <label>تأكيد كلمة المرور الجديدة</label>
              <input type="password" required value={again} onChange={(e) => setAgain(e.target.value)} />
            </div>
            {error && <p className="err">{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn">حفظ</button>
              <button type="button" className="sm" onClick={onClose}>إلغاء</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
