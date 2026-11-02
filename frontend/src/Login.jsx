import { useState } from "react";
import { login } from "./api";

export default function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    try {
      await login(email, password);
      onDone();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="login">
      <div className="card">
        <h3>تسجيل الدخول</h3>
        <label>البريد الإلكتروني</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={{ marginTop: 10 }}>كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="err">{error}</p>}
        <button className="btn" style={{ marginTop: 12 }} onClick={submit}>
          دخول
        </button>
      </div>
    </div>
  );
}