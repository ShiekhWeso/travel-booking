import { useCallback, useEffect, useState } from "react";
import Login from "./Login";
import Bookings from "./Bookings";
import BookingForm from "./BookingForm";
import Dashboard from "./Dashboard";
import Alerts from "./Alerts";
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
  const [alerts, setAlerts] = useState({ unread: 0, items: [] });
  const [panel, setPanel] = useState(false);

  const loadAlerts = useCallback(() => {
    api("/alerts").then(setAlerts).catch(() => {});
  }, []);

  useEffect(() => {
    if (logged) api("/auth/me").then(setMe).catch(() => {});
  }, [logged]);

  useEffect(() => {
    if (!logged) return;
    loadAlerts();
    const t = setInterval(loadAlerts, 60000);
    return () => clearInterval(t);
  }, [logged, loadAlerts]);

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
        <div className="hbtns">
          <button
            className={"bell" + (alerts.unread ? " ring" : "")}
            title="التنبيهات"
            onClick={() => setPanel(true)}
          >
            <img src="/bell.png" alt="التنبيهات" />
            {alerts.unread > 0 && <span className="badge">{alerts.unread}</span>}
          </button>
          <button onClick={() => { setToken(null); setLogged(false); setMe(null); }}>
            خروج ({me.name})
          </button>
        </div>
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
      <Alerts
        open={panel}
        data={alerts}
        me={me}
        isAdmin={isAdmin}
        onClose={() => setPanel(false)}
        onChanged={loadAlerts}
      />
    </>
  );
}