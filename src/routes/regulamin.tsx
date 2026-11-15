import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "../components/landing/LegalPage";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin · Ki Legends" },
      { name: "description", content: "Regulamin korzystania z gry Ki Legends." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Regulamin">
      <h2>1. Postanowienia ogólne</h2>
      <p>
        Ki Legends to gra przeglądarkowa działająca na serwerze. Usługodawcą jest [nazwa, adres i
        dane kontaktowe usługodawcy]. Regulamin określa zasady korzystania z konta i gry.
      </p>
      <h2>2. Konto</h2>
      <p>
        Do gry potrzebne jest konto z adresem e-mail, nickiem i hasłem. Konto aktywuje się linkiem
        wysłanym na podany adres. Gracz odpowiada za zachowanie hasła w tajemnicy. Postacie i postęp
        są zapisywane na serwerze gry.
      </p>
      <h2>3. Zasady gry</h2>
      <p>
        Zabronione jest korzystanie z błędów gry, automatów do grania, ingerowanie w pracę serwera
        oraz nick naruszający prawa innych osób lub dobre obyczaje. Usługodawca może zablokować
        konto naruszające te zasady. [Szczegółowe zasady i procedura odwołania.]
      </p>
      <h2>4. Odpłatność</h2>
      <p>[Informacja, czy gra jest bezpłatna, oraz zasady ewentualnych płatności.]</p>
      <h2>5. Odpowiedzialność i dostępność</h2>
      <p>
        Gra jest w rozwoju, a serwer może być okresowo niedostępny w związku z konserwacją.
        Usługodawca dba o bezpieczeństwo zapisów, ale nie gwarantuje ich nieprzerwanej dostępności.
        [Postanowienia o odpowiedzialności.]
      </p>
      <h2>6. Reklamacje i kontakt</h2>
      <p>[Adres e-mail i sposób składania reklamacji.]</p>
      <h2>7. Zmiany regulaminu</h2>
      <p>[Zasady powiadamiania o zmianach regulaminu.]</p>
    </LegalPage>
  );
}
