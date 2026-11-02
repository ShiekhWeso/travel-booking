import { useState } from "react";
import Login from "./Login";
import { getToken, setToken } from "./api";

export default function App() {
  const [logged, setLogged] = useState(!!getToken());

  if (!logged) return <Login onDone={() => setLogged(true)} />;

  return (
    <>
      <header>
        <span>نظام إدارة الحجوزات والرحلات</span>
        <button onClick={() => { setToken(null); setLogged(false); }}>
          خروج
        </button>
      </header>
      <main>
        <div className="card">تم تسجيل الدخول بنجاح</div>
      </main>
    </>
  );
}