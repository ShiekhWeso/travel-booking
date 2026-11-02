import { useState } from "react";
import Login from "./Login";
import Bookings from "./Bookings";
import BookingForm from "./BookingForm";
import { getToken, setToken } from "./api";

const TABS = [
  ["d", "لوحة التحكم"],
  ["t", "الحجوزات"],
  ["n", "حجز جديد"],
];

export default function App() {
  const [logged, setLogged] = useState(!!getToken());
  const [tab, setTab] = useState("t");
  const [editing, setEditing] = useState(null);

  if (!logged) return <Login onDone={() => setLogged(true)} />;

  function go(k) {
    setEditing(null);
    setTab(k);
  }

  return (
    <>
      <header>
        <span>نظام إدارة الحجوزات والرحلات</span>
        <button onClick={() => { setToken(null); setLogged(false); }}>خروج</button>
      </header>
      <nav>
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "t" && (
          <Bookings onEdit={(b) => { setEditing(b); setTab("n"); }} />
        )}
        {tab === "d" && <div className="card">قريبًا</div>}
        {tab === "n" && (
          <BookingForm
            key={editing?.id || "new"}
            booking={editing}
            onSaved={() => go("t")}
          />
        )}
      </main>
    </>
  );
}