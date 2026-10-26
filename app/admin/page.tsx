import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submissionsEnabled } from "@/lib/features";
import { isAdmin } from "@/lib/auth";
import { letters, localAuth, rsvps } from "@/lib/local-store";
import { answerKeys, CHILDREN } from "@/lib/event";
import AdminLogin, { Logout } from "@/components/AdminLogin";
export const metadata: Metadata = {
  title: "Скринька спогадів — для організаторів",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; kind?: string }>;
}) {
  if (!submissionsEnabled) notFound();
  localAuth();
  if (!(await isAdmin()))
    return (
      <main className="admin-shell">
        <Link className="admin-back" href="/">
          ← До запрошення
        </Link>
        <AdminLogin />
      </main>
    );
  const { child, kind } = await searchParams;
  const rsvp = kind === "rsvp";
  const items = letters(child),
    attendance = rsvps();
  return (
    <main className="admin-shell">
      <Link className="admin-back" href="/">
        ← До запрошення
      </Link>
      <header>
        <div>
          <h1>Скринька спогадів</h1>
          <p>Листи та відповіді ваших гостей</p>
        </div>
        <Logout />
      </header>
      <nav className="admin-filters" aria-label="Фільтр відповідей">
        <Link className={!rsvp && !child ? "active" : ""} href="/admin">
          Усі листи
        </Link>
        <Link
          className={!rsvp && child === "vladyslav" ? "active" : ""}
          href="/admin?child=vladyslav"
        >
          Владислав
        </Link>
        <Link
          className={!rsvp && child === "liliia" ? "active" : ""}
          href="/admin?child=liliia"
        >
          Лілія
        </Link>
        <Link className={rsvp ? "active" : ""} href="/admin?kind=rsvp">
          Присутність
        </Link>
      </nav>
      <div className="admin-export">
        <a
          className="button secondary"
          href={`/api/admin/export?kind=${rsvp ? "rsvp" : "letters"}${child ? `&child=${encodeURIComponent(child)}` : ""}`}
        >
          Завантажити CSV
        </a>
      </div>
      {rsvp ? (
        attendance.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Гість</th>
                  <th>Буде</th>
                  <th>Гостей</th>
                  <th>Коментар</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((row) => (
                  <tr key={row.id}>
                    <td>{row.guest_name}</td>
                    <td>{row.attending ? "Так" : "Ні"}</td>
                    <td>{row.guests}</td>
                    <td>{row.comment || "—"}</td>
                    <td>
                      {new Date(row.created_at).toLocaleString("uk-UA", {
                        timeZone: "Europe/Kyiv",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">Відповідей поки немає.</p>
        )
      ) : items.length ? (
        items.map((letter) => (
          <article className="admin-letter" key={letter.id}>
            <h2>Лист для {CHILDREN[letter.child].recipient}</h2>
            <strong>{letter.guest_name}</strong>
            <br />
            <time dateTime={letter.created_at}>
              {new Date(letter.created_at).toLocaleString("uk-UA", {
                timeZone: "Europe/Kyiv",
              })}
            </time>
            <dl>
              {answerKeys.map((key, i) => (
                <div key={key}>
                  <dt>{CHILDREN[letter.child].questions[i]}</dt>
                  <dd>{letter.answers[key]}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))
      ) : (
        <p className="admin-empty">Перші листи ще попереду.</p>
      )}
      <p className="admin-notice">
        Відповіді зберігаються лише на цьому комп’ютері. Регулярно зберігайте
        CSV або резервну копію бази.
      </p>
    </main>
  );
}
