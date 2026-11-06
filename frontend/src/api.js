const API = import.meta.env.VITE_API_URL;

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

export async function download(path, filename) {
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    return;
  }
  if (!res.ok) {
    let msg = "حدث خطأ";
    try { msg = (await res.json()).detail || msg; } catch {/* ignore */}
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}