import Link from "next/link";
export default function NotFound() {
  return (
    <main
      className="section"
      style={{ textAlign: "center", minHeight: "80vh" }}
    >
      <h1>Ця стежинка загубилася…</h1>
      <p>Але наша казка зовсім поруч.</p>
      <Link className="button" href="/">
        Повернутися до запрошення
      </Link>
    </main>
  );
}
