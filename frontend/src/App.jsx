import { useEffect, useState } from "react";
import Login from "./Login";
import Bookings from "./Bookings";
import BookingForm from "./BookingForm";
import Dashboard from "./Dashboard";
import { api, getToken, setToken } from "./api";

const TABS = [
  ["d", "لوحة التحكم"],
  ["t", "الحجوزات"],
  ["n", "حجز جديد"],
];

export default function App() {
  const [logged, setLogged] = useState(!!getToken());
  const [tab, setTab] = useState("d");
  const [editing, setEditing] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (logged) api("/auth/me").then(setMe).catch(() => {});
  }, [logged]);

  if (!logged) return <Login onDone={() => setLogged(true)} />;
  if (!me) return <div className="card">جاري التحميل...</div>;

  const isAdmin = me.role === "admin";

  function go(k) {
    setEditing(null);
    setTab(k);
  }

  return (
    <>
      <header>
        <span>نظام إدارة الحجوزات والرحلات</span>
        <button onClick={() => { setToken(null); setLogged(false); setMe(null); }}>
          خروج ({me.name})
        </button>
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
          <Bookings
            isAdmin={isAdmin}
            onEdit={(b) => { setEditing(b); setTab("n"); }}
          />
        )}
        {tab === "d" && <Dashboard isAdmin={isAdmin} />}
        {tab === "n" && (
          <BookingForm
            key={editing?.id || "new"}
            booking={editing}
            isAdmin={isAdmin}
            onSaved={() => go("t")}
          />
        )}
      </main>
    </>
  );
}