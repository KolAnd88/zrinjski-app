import './ClubCrest.css';

/**
 * Grb kluba — jedini brend znak u web adminu.
 *
 * Prije je na svakom zaslonu stajao crveni kvadratić s kraticom: "ZRI" na
 * prijavi, u sidebaru i na ulaznoj stranici, a "ZC" na semaforu, od starog
 * imena turnira. Tri različita zaslona, dva različita znaka, nijedan pravi.
 *
 * Klub ima grb i on je već u aplikaciji na telefonu — ovo je ista slika
 * (`apps/mobile/assets/crest.png`), pa web i mobitel izgledaju kao jedno.
 *
 * Veličinu zadaje mjesto na koje se stavlja, kroz `className`; komponenta
 * određuje samo da se grb uklapa u okvir bez rezanja.
 */
export function ClubCrest({ className = '' }: { className?: string }) {
  return (
    <img
      className={`grb ${className}`.trim()}
      src="/grb.png"
      alt="VHMRK Zrinjski Mostar"
      width={256}
      height={256}
      draggable={false}
    />
  );
}
