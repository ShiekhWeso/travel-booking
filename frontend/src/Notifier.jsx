import { useEffect, useState } from "react";

const SEEN = "notified-keys";
const LABEL = { urgent: "عاجل", today: "اليوم", message: "رسالة", info: "قريبًا" };

const dayStr = () => new Date().toLocaleDateString("en-CA");

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...set].slice(-300)));
  } catch {
    /* ignore */
  }
}

async function pushBrowser(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, icon: "/pwa-192.png", dir: "rtl", lang: "ar" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch {
    /* ignore */
  }
}

export default function Notifier({ data, onOpen }) {
  const [toasts, setToasts] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!data) return;

    // urgent flights and new messages: notify once each
    const seen = loadSeen();
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const fresh = data.items.filter(
      (i) =>
        !i.read &&
        !seen.has(i.key) &&
        (i.level === "urgent" ||
          (i.level === "message" && new Date(i.when).getTime() > dayAgo))
    );
    if (fresh.length) {
      fresh.forEach((i) => {
        seen.add(i.key);
        pushBrowser(i.title, i.text);
        setTimeout(
          () => setToasts((t) => t.filter((x) => x.key !== i.key)),
          20000
        );
      });
      saveSeen(seen);
      setToasts((t) => [...t, ...fresh]);
    }

    // daily summary: first time open after 9:00
    const dayKey = "summary-" + dayStr();
    if (new Date().getHours() >= 9 && !localStorage.getItem(dayKey)) {
      const list = data.items.filter(
        (i) => !i.read && (i.level === "today" || i.level === "urgent")
      );
      if (list.length) {
        localStorage.setItem(dayKey, "1");
        setSummary(list);
      }
    }
  }, [data]);

  return (
    <>
      <div className="toasts">
        {toasts.map((t) => (
          <div
            key={t.key}
            className={`toast ${t.level}`}
            onClick={() => {
              setToasts((x) => x.filter((y) => y.key !== t.key));
              onOpen();
            }}
          >
            <b>{t.title}</b>
            <p>{t.text}</p>
          </div>
        ))}
      </div>

      {summary && (
        <div className="drawer-bg" onClick={() => setSummary(null)}>
          <div className="daysum" onClick={(e) => e.stopPropagation()}>
            <h3>ملخص اليوم</h3>
            {summary.map((i) => (
              <div key={i.key} className={`alert ${i.level}`}>
                <div className="alert-top">
                  <span className="tag">{LABEL[i.level]}</span>
                </div>
                <b>{i.title}</b>
                <p>{i.text}</p>
              </div>
            ))}
            <div className="sumbtns">
              <button
                className="btn"
                onClick={() => { setSummary(null); onOpen(); }}
              >
                فتح التنبيهات
              </button>
              <button className="x" onClick={() => setSummary(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}