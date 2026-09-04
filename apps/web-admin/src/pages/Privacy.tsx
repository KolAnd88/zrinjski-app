import './Privacy.css';

/**
 * Politika privatnosti — javna stranica.
 *
 * Postoji jer Google Play traži JAVNU POVEZNICU na politiku prije objave, a
 * projekt je nije imao nigdje. Namjerno je stranica u web adminu, a ne zaseban
 * dokument: adresa je stalna, mijenja se s ostatkom koda i ne može se izgubiti.
 *
 * Sadržaj je pisan prema onome što aplikacija STVARNO radi — provjereno u
 * shemi baze i kodu, ne prepisano s predloška. Ako se skupljanje podataka
 * promijeni, mijenja se i ovaj tekst.
 */

/**
 * Kontakt kluba. Ova adresa nije ukras — kroz nju ide zahtjev za uvid,
 * ispravak ili brisanje podataka, pa mora biti stvarna i čitana.
 * Ako se promijeni, mijenja se ovdje i nigdje drugdje.
 */
const KONTAKT = {
  klub: 'VHMRK Zrinjski Mostar',
  email: 'vhmrkzrinjski1994@gmail.com',
  azurirano: '4. rujna 2026.',
};

function Odjeljak({ naslov, children }: { naslov: string; children: React.ReactNode }) {
  return (
    <section className="priv__sec">
      <h2 className="priv__h2">{naslov}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <div className="priv">
      <article className="priv__box">
        <h1 className="priv__h1">Politika privatnosti</h1>
        <p className="priv__meta">
          {KONTAKT.klub} · zadnja izmjena {KONTAKT.azurirano}
        </p>

        <p className="priv__lead">
          Ova aplikacija služi praćenju rukometnog turnira veterana. Ne prikazuje oglase, ne
          koristi alate za analitiku niti praćenje korisnika, i ne prodaje niti ustupa podatke
          trećima u marketinške svrhe.
        </p>

        <Odjeljak naslov="Gledatelji — što se sprema">
          <p>
            Za korištenje aplikacije <strong>nije potreban račun</strong>. Ne tražimo ime, e-mail
            ni broj telefona.
          </p>
          <p>Ako uključiš obavijesti, sprema se:</p>
          <ul>
            <li>
              <strong>oznaka uređaja za obavijesti</strong> (Expo push token) — bez nje ne možemo
              poslati obavijest;
            </li>
            <li>
              <strong>ekipe koje pratiš</strong> — da ti ne šaljemo obavijesti o utakmicama koje te
              ne zanimaju;
            </li>
            <li>
              <strong>jezik sučelja i vrste obavijesti</strong> koje si uključio.
            </li>
          </ul>
          <p>
            Ta oznaka ne sadrži tvoje ime niti se može povezati s tvojim identitetom. Ako isključiš
            obavijesti ili obrišeš aplikaciju, zapis prestaje biti koristan i briše se — dio
            automatski, kad davatelj usluge javi da uređaj više ne prima poruke.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Predstavnici klubova">
          <p>Predstavnik koji prijavljuje ekipu ostavlja:</p>
          <ul>
            <li>ime i e-mail adresu — za prijavu u portal i za kontakt oko turnira;</li>
            <li>naziv ekipe i popis igrača (ime, broj dresa, oznaka kapetana).</li>
          </ul>
          <p>
            Ti podaci koriste se isključivo za vođenje turnira: sastave, zapisnik, raspored i
            statistiku. Imena igrača i brojevi dresova javno su vidljivi u aplikaciji, kao i na
            svakom zapisniku utakmice — to je svrha natjecanja.
          </p>
          <p>
            <strong>E-mail adrese nisu javne.</strong> Vidi ih samo organizacija turnira.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Organizatori">
          <p>
            Članovi organizacije i delegati imaju račun s e-mail adresom i ulogom. Služi za pristup
            unosu rezultata i postavkama turnira.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Fotografije">
          <p>
            Fotografije u galeriji objavljuje organizacija. Ako se na fotografiji prepoznaješ i ne
            želiš da bude objavljena, javi se na adresu na dnu i uklonit ćemo je.
          </p>
        </Odjeljak>

        <Odjeljak naslov="S kim se podaci dijele">
          <p>Podatke ne prodajemo i ne ustupamo za marketing. Koristimo ove usluge:</p>
          <ul>
            <li>
              <strong>Supabase</strong> — baza podataka i pohrana datoteka;
            </li>
            <li>
              <strong>Expo i Google (Firebase Cloud Messaging)</strong> — isporuka obavijesti na
              uređaj. Njima putuje oznaka uređaja i tekst obavijesti;
            </li>
            <li>
              <strong>Netlify</strong> — posluživanje web dijela.
            </li>
          </ul>
          <p>
            Ne koristimo Google Analytics ni sličan alat, i ne pratimo ponašanje korisnika unutar
            aplikacije.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Koliko se čuva">
          <p>
            Podaci o turniru (rezultati, sastavi, statistika) čuvaju se trajno, jer su rezultati
            natjecanja povijesni zapis kluba.
          </p>
          <p>
            Oznake uređaja za obavijesti brišu se kad uređaj prestane primati poruke ili na tvoj
            zahtjev.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Tvoja prava">
          <p>
            Možeš zatražiti uvid u podatke koji se na tebe odnose, njihov ispravak ili brisanje.
            Dovoljno je pisati na adresu ispod; odgovaramo u razumnom roku.
          </p>
          <p>
            Obavijesti možeš isključiti u samoj aplikaciji, bez ikakvog zahtjeva — u postavkama
            obavijesti.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Djeca">
          <p>
            Aplikacija je namijenjena praćenju turnira veterana i nije usmjerena djeci. Ne
            prikupljamo svjesno podatke djece mlađe od 13 godina.
          </p>
        </Odjeljak>

        <Odjeljak naslov="Izmjene">
          <p>
            Ako se način prikupljanja podataka promijeni, mijenja se i ovaj tekst, uz novi datum na
            vrhu stranice.
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
