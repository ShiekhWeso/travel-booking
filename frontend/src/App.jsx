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
  const isAdmin = me?.role === "admin";

  if (!logged) return <Login onDone={() => setLogged(true)} />;

  function go(k) {
    setEditing(null);
    setTab(k);
  }

  return (
    <>
      <header>
        <span>نظام إدارة الحجوزات والرحلات</span>
        <button onClick={() => { setToken(null); setLogged(false); setMe(null); }}>
          خروج {me ? `(${me.name})` : ""}
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
          <Bookings onEdit={(b) => { setEditing(b); setTab("n"); }} />
        )}
        {tab === "d" && <Dashboard />}
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