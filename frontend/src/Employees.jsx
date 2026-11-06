import { useEffect, useState } from "react";
import { api } from "./api";

const ROLES = { admin: "مدير", employee: "موظف" };
const EMPTY = { name: "", email: "", password: "", role: "employee" };

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export default function Employees({ me }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = () =>
    api("/employees/all").then(setList).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function call(path, method, body, okMsg) {
    setError("");
    setMsg("");
    try {
      await api(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setMsg(okMsg);
      load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function add(e) {
    e.preventDefault();
    const ok = await call(
      "/employees",
      "POST",
      form,
      `تم إنشاء الحساب. البريد: ${form.email.trim().toLowerCase()} | كلمة المرور: ${form.password}`
    );
    if (ok) setForm(EMPTY);
  }

  function edit(emp) {
    const name = window.prompt("الاسم", emp.name);
    if (name === null) return;
    const email = window.prompt("البريد الإلكتروني", emp.email);
    if (email === null) return;
    call(`/employees/${emp.id}`, "PUT", { name, email }, "تم حفظ التعديل");
  }

  function resetPassword(emp) {
    const pw = window.prompt(
      `كلمة مرور جديدة لـ ${emp.name} (8 أحرف على الأقل):`,
      randomPassword()
    );
    if (!pw) return;
    call(
      `/employees/${emp.id}/password`,
      "PUT",
      { password: pw },
      `تم تغيير كلمة مرور ${emp.name}. الكلمة الجديدة: ${pw}`
    );
  }

  function toggle(emp) {
    const action = emp.is_active ? "deactivate" : "activate";
    const text = emp.is_active
      ? `إيقاف ${emp.name}؟ لن يستطيع تسجيل الدخول، وتبقى حجوزاته كما هي.`
      : `إعادة تفعيل ${emp.name}؟`;
    if (!window.confirm(text)) return;
    call(
      `/employees/${emp.id}/${action}`,
      "POST",
      null,
      emp.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب"
    );
  }

  function remove(emp) {
    if (!window.confirm(`حذف ${emp.name} نهائيًا؟ لا يمكن التراجع.`)) return;
    call(`/employees/${emp.id}`, "DELETE", null, "تم حذف الموظف");
  }

  return (
    <>
      <div className="card">
        <h3>إضافة موظف</h3>
        <form onSubmit={add}>
          <div className="f">
            <div>
              <label>الاسم</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label>البريد الإلكتروني</label>
              <input
                required
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label>كلمة المرور (8 أحرف على الأقل)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  required
                  minLength={8}
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="sm"
                  onClick={() => setForm({ ...form, password: randomPassword() })}
                >
                  توليد
                </button>
              </div>
            </div>
            <div>
              <label>الصلاحية</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="employee">موظف</option>
                <option value="admin">مدير</option>
              </select>
            </div>
          </div>
          <button className="btn" style={{ marginTop: 12 }}>إضافة</button>
        </form>
        {error && <p className="err">{error}</p>}
        {msg && <p style={{ color: "var(--gr)", fontWeight: 700 }}>{msg}</p>}
      </div>

      <div className="card">
        <h3>الموظفون</h3>
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الصلاحية</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((emp) => (
                <tr key={emp.id} style={emp.is_active ? undefined : { opacity: 0.6 }}>
                  <td>{emp.name}</td>
                  <td dir="ltr" style={{ textAlign: "start" }}>{emp.email}</td>
                  <td>{ROLES[emp.role] || emp.role}</td>
                  <td>
                    <span className={`b ${emp.is_active ? "paid" : "unpaid"}`}>
                      {emp.is_active ? "فعّال" : "موقوف"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="sm" onClick={() => edit(emp)}>تعديل</button>{" "}
                    <button className="sm" onClick={() => resetPassword(emp)}>كلمة المرور</button>{" "}
                    {emp.id !== me.id && (
                      <>
                        <button className="sm" onClick={() => toggle(emp)}>
                          {emp.is_active ? "إيقاف" : "تفعيل"}
                        </button>{" "}
                        <button className="sm danger" onClick={() => remove(emp)}>حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
