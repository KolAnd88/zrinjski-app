import './Privacy.css';

/**
 * Brisanje računa — javna stranica.
 *
 * Postoji jer Google Play traži DVIJE stvari za svaku aplikaciju u kojoj se
 * može otvoriti račun: put unutar aplikacije i JAVNU web adresu do koje se
 * dođe bez instaliranja aplikacije i bez prijave. Bez toga se aplikacija ne
 * prima u trgovinu.
 *
 * Namjerno dijeli izgled s politikom privatnosti: isti je rod dokumenta i
 * čita se u istoj prilici.
 *
 * Sadržaj opisuje što se stvarno briše, provjereno u shemi baze. Ako se
 * shema promijeni, mijenja se i ovaj tekst.
 */

const KONTAKT = {
  klub: 'VHMRK Zrinjski Mostar',
  email: 'vhmrkzrinjski1994@gmail.com',
  azurirano: '8. rujna 2026.',
};

function Odjeljak({ naslov, children }: { naslov: string; children: React.ReactNode }) {
  return (
    <section className="priv__sec">
      <h2 className="priv__h2">{naslov}</h2>
      {children}
    </section>
  );
}

export function DeleteAccount() {
  return (
    <div className="priv">
      <article className="priv__box">
        <h1 className="priv__h1">Brisanje računa</h1>
        <p className="priv__meta">
          {KONTAKT.klub} · zadnja izmjena {KONTAKT.azurirano}
        </p>

        <p className="priv__lead">
          Račun u aplikaciji <strong>Ponos Hercegovine 2026</strong> imaju samo predstavnici
          klubova i organizatori. Gledateljima račun ne treba i nemaju ga.
        </p>

        <Odjeljak naslov="Kako zatražiti brisanje">
          <p>
            Pošalji poruku s adrese na koju je račun otvoren na{' '}
            <a href={`mailto:${KONTAKT.email}?subject=Zahtjev%20za%20brisanje%20ra%C4%8Duna`}>
              {KONTAKT.email}
            </a>{' '}
            i napiši da tražiš brisanje računa.
          </p>
          <p>
            Tražimo poruku s te iste adrese jer je to jedini način da provjerimo da zahtjev
            dolazi od vlasnika računa. Drugih podataka ne trebamo.
          </p>
          <p>
            Račun brišemo <strong>u roku od 30 dana</strong>, a u pravilu isti tjedan.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Što se briše">
          <ul>
            <li>korisnički račun i mogućnost prijave;</li>
            <li>e-mail adresa predstavnika;</li>
            <li>veza računa s ekipom;</li>
            <li>oznaka uređaja za obavijesti, ako je bila postavljena.</li>
          </ul>
        </Odjeljak>

        <Odjeljak naslov="Što ostaje i zašto">
          <p>
            Rezultati odigranih utakmica, sastavi ekipa i statistika <strong>ostaju</strong>.
            To su rezultati natjecanja — povijesni zapis kluba, isti kao zapisnik na papiru.
            Brisanjem računa organizatora ili predstavnika ne bi se smjelo mijenjati tko je
            koliko golova dao na turniru.
          </p>
          <p>
            Ako želiš da se ukloni i ime igrača iz sastava, napiši to u istoj poruci pa ćemo
            pogledati svaki slučaj posebno.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Ako nemaš račun">
          <p>
            Za korištenje aplikacije račun <strong>nije potreban</strong>. Ako si samo pratio
            turnir, o tebi ne postoji račun koji bi se brisao — dovoljno je obrisati
            aplikaciju. Više o tome što se sprema piše u{' '}
            <a href="/privatnost">politici privatnosti</a>.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Kontakt">
          <p>
            {KONTAKT.klub}
            <br />
            <a href={`mailto:${KONTAKT.email}`}>{KONTAKT.email}</a>
          </p>
        </Odjeljak>
      </article>
    </div>
  );
}
