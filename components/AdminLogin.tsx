"use client";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LoaderCircle } from "lucide-react";
export default function AdminLogin() {
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const password = String(new FormData(e.currentTarget).get("password"));
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося увійти.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="admin-login">
      <LockKeyhole size={26} />
      <h1>Скринька спогадів</h1>
      <p>Лише для організаторів свята.</p>
      <form onSubmit={login}>
        <label htmlFor="admin-password">Пароль</label>
        <input
          type="password"
          id="admin-password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        <button className="button" disabled={loading}>
          {loading ? <LoaderCircle size={18} className="spin" /> : "Увійти"}
        </button>
        <p role="alert" className="form-message">
          {error}
        </p>
      </form>
    </div>
  );
}
export function Logout() {
  const router = useRouter();
  return (
    <button
      className="logout"
      onClick={async () => {
        const response = await fetch("/api/admin/logout", { method: "POST" });
        if (response.ok) router.refresh();
      }}
    >
      Вийти
    </button>
  );
}
