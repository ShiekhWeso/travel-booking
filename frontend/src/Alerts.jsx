import { useEffect, useState } from "react";
import { api } from "./api";

const LABEL = { urgent: "عاجل", today: "اليوم", message: "رسالة", info: "قريبًا" };

export default function Alerts({ open, data, me, isAdmin, onClose, onChanged }) {
  const [employees, setEmployees] = useState([]);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
   const [perm, setPerm] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (open && isAdmin) api("/employees").then(setEmployees).catch(() => {});
  }, [open, isAdmin]);

  if (!open) return null;

  async function read(keys) {
    if (!keys.length) return;
    await api("/alerts/read", { method: "POST", body: JSON.stringify({ keys }) });
    onChanged();
  }

  async function send() {
    if (!text.trim()) return;
    try {
      await api("/alerts/messages", {
        method: "POST",
        body: JSON.stringify({ to_employee_id: to ? Number(to) : null, text }),
      });
      setText("");
      setStatus("تم الإرسال");
    } catch (e) {
      setStatus(e.message);
    }
    setTimeout(() => setStatus(""), 2500);
  }

  const unreadKeys = data.items.filter((i) => !i.read).map((i) => i.key);

  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>
            التنبيهات
            {data.unread > 0 && <span className="badge in">{data.unread}</span>}
          </h3>
          <button className="x" onClick={onClose}>إغلاق</button>
        </div>

        {isAdmin && (
          <div className="sendbox">
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">كل الموظفين</option>
              {employees
                .filter((e) => e.id !== me.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
            </select>
            <textarea
              rows="2"
              placeholder="اكتب تنبيهًا للموظف..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" onClick={send}>إرسال</button>
            {status && <small>{status}</small>}
          </div>
        )}

        {perm === "default" && (
          <button
            className="readall"
            onClick={async () => setPerm(await Notification.requestPermission())}
          >
            تفعيل إشعارات المتصفح
          </button>
        )}

        {unreadKeys.length > 0 && (
          <button className="readall" onClick={() => read(unreadKeys)}>
            تعليم الكل كمقروء
          </button>
        )}

        <div className="alist">
          {data.items.length === 0 && <p className="empty">لا توجد تنبيهات الآن</p>}
          {data.items.map((i) => (
            <div
              key={i.key}
              className={`alert ${i.level}${i.read ? " seen" : ""}`}
              onClick={() => !i.read && read([i.key])}
            >
              <div className="alert-top">
                <span className="tag">{LABEL[i.level]}</span>
                {!i.read && <span className="dot" />}
              </div>
              <b>{i.title}</b>
              <p>{i.text}</p>
              {i.booking_no && <small>حجز #{i.booking_no}</small>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}