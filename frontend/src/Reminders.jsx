import { useEffect, useState } from "react";
import { api } from "./api";

export default function Reminders({ bookingId, pending, setPending }) {
  const [list, setList] = useState([]);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!bookingId) return;
    api(`/reminders?booking_id=${bookingId}`)
      .then(setList)
      .catch((e) => setError(e.message));
  }, [bookingId, tick]);

  const refresh = () => setTick((t) => t + 1);

  async function add() {
    if (!date || !text.trim()) {
      setError("اكتب التاريخ والنص");
      return;
    }
    setError("");
    if (bookingId) {
      try {
        await api("/reminders", {
          method: "POST",
          body: JSON.stringify({ booking_id: bookingId, remind_on: date, text }),
        });
        refresh();
      } catch (e) {
        setError(e.message);
        return;
      }
    } else {
      setPending([...pending, { remind_on: date, text: text.trim() }]);
    }
    setDate("");
    setText("");
  }

  async function toggle(r) {
    await api(`/reminders/${r.id}/done?done=${!r.done}`, { method: "POST" });
    refresh();
  }

  async function remove(r) {
    await api(`/reminders/${r.id}`, { method: "DELETE" });
    refresh();
  }

  const rows = bookingId ? list : pending;

  return (
    <>
      {rows.length === 0 && (
        <p style={{ color: "var(--mu)", fontSize: 13 }}>لا توجد تذكيرات</p>
      )}
      {rows.map((r, i) => (
        <div className={"rem" + (r.done ? " done" : "")} key={r.id || i}>
          {bookingId && (
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={r.done}
              onChange={() => toggle(r)}
            />
          )}
          <span>{r.remind_on} — {r.text}</span>
          <button
            className="sm danger"
            onClick={() =>
              bookingId ? remove(r) : setPending(pending.filter((_, j) => j !== i))
            }
          >
            حذف
          </button>
        </div>
      ))}
      <div className="remadd">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          placeholder="نص التذكير"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="sm" onClick={add}>+ إضافة</button>
      </div>
      {error && <p className="err">{error}</p>}
    </>
  );
}