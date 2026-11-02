const API = "http://127.0.0.1:8000";

export const getToken = () => localStorage.getItem("token");
export const setToken = (t) =>
  t ? localStorage.setItem("token", t) : localStorage.removeItem("token");

export async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
  }
  if (!res.ok) throw new Error((await res.json()).detail || "حدث خطأ");
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(API + "/auth/login", {
    method: "POST",
    body: new URLSearchParams({ username: email, password }),
  });
  if (!res.ok) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
  setToken((await res.json()).access_token);
}