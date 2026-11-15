import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import "./landing.css";

/** Frame for the regulations and the privacy policy. The texts are drafts until the owner fills and legally reviews them. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="ki-legal">
      <article>
        <p className="ki-legal-draft" role="note">
          PROJEKT. Ten tekst opisuje, jak działa gra technicznie, i wymaga uzupełnienia danych
          administratora oraz przeglądu prawnego przed publicznym uruchomieniem. Pola w nawiasach
          kwadratowych czekają na decyzję właściciela.
        </p>
        <h1>{title}</h1>
        {children}
        <p>
          <Link to="/">← Wróć do strony głównej</Link>
        </p>
      </article>
    </main>
  );
}
