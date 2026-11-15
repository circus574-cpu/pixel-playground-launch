import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "../components/landing/LegalPage";

export const Route = createFileRoute("/prywatnosc")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności · Ki Legends" },
      { name: "description", content: "Jakie dane zbiera gra Ki Legends i jak ich używa." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Polityka prywatności">
      <h2>1. Administrator danych</h2>
      <p>
        [Nazwa, adres i dane kontaktowe administratora oraz ewentualnego inspektora ochrony danych.]
      </p>
      <h2>2. Jakie dane przetwarzamy</h2>
      <ul>
        <li>
          <b>Konto:</b> adres e-mail, nick, skrót hasła (hasło nie jest przechowywane jawnie), daty
          utworzenia konta i ostatniego logowania.
        </li>
        <li>
          <b>Rozgrywka:</b> postacie i ich postęp, zapisywane na serwerze gry.
        </li>
        <li>
          <b>Dane techniczne:</b> adres IP jest używany do ograniczania liczby prób logowania i
          rejestracji (licznik w pamięci serwera, bez trwałego zapisu). Przeglądarka przechowuje
          lokalnie token odświeżania sesji, aby gracz pozostał zalogowany.
        </li>
      </ul>
      <h2>3. Cele i podstawy prawne</h2>
      <p>
        Prowadzenie konta i zapis postaci (wykonanie umowy), bezpieczeństwo serwera i ochrona przed
        nadużyciami (prawnie uzasadniony interes). [Pozostałe cele i podstawy.]
      </p>
      <h2>4. Odbiorcy danych</h2>
      <p>
        Wiadomości z linkami aktywacyjnymi i resetem hasła wysyła dostawca usługi poczty
        transakcyjnej (Resend). [Dostawca hostingu serwera i inni odbiorcy.]
      </p>
      <h2>5. Okres przechowywania</h2>
      <p>
        [Jak długo przechowywane są dane konta i postaci oraz co dzieje się po usunięciu konta.]
      </p>
      <h2>6. Prawa osoby, której dane dotyczą</h2>
      <p>
        Dostęp do danych, sprostowanie, usunięcie, ograniczenie przetwarzania, przenoszenie,
        sprzeciw oraz skarga do organu nadzorczego. [Kontakt w sprawie realizacji praw.]
      </p>
      <h2>7. Pliki cookie i pamięć przeglądarki</h2>
      <p>
        Gra nie korzysta z narzędzi analitycznych ani reklamowych. Używa pamięci lokalnej
        przeglądarki do utrzymania sesji oraz do ustawień gry (np. skala interfejsu).
      </p>
    </LegalPage>
  );
}
