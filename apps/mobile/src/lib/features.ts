// features.ts — prekidači za dijelove aplikacije koji se pale i gase odlukom,
// a ne kodom.
//
// Postoji da se sadržaj ne briše kad se privremeno ne želi prikazivati. Kod
// ostaje na mjestu, ekran radi, samo se ne nudi — pa je povratak jedan `true`,
// bez arheologije po povijesti izmjena.

/**
 * Galerija fotografija.
 *
 * Ugašena jer za turnir 2026. još nema slika, a prazna kartica u traci izgleda
 * kao da nešto ne radi. Kad slike dođu, ovo se vrati na `true` i kartica se
 * pojavi zajedno s prečacem na Početnoj — ekran i podaci su netaknuti.
 */
export const GALERIJA = false;
