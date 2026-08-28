import { describe, expect, it } from 'vitest';
import { hasText, pickText } from './texts';

describe('pickText — dvojezični tekstovi turnira', () => {
  it('hrvatsko sučelje uvijek dobiva hrvatski', () => {
    expect(pickText('Pravila', 'Rules', 'hr')).toBe('Pravila');
  });

  it('englesko sučelje dobiva engleski kad postoji', () => {
    expect(pickText('Pravila', 'Rules', 'en')).toBe('Rules');
  });

  // Organizator piše hrvatski; engleski je neobavezan i najčešće ga nema.
  it('englesko sučelje pada na hrvatski kad engleskog nema', () => {
    expect(pickText('Pravila', null, 'en')).toBe('Pravila');
    expect(pickText('Pravila', '', 'en')).toBe('Pravila');
  });

  // Polje s razmacima korisnik je ostavio praznim, ma što baza sadržavala.
  it('sami razmaci se broje kao prazno', () => {
    expect(pickText('Pravila', '   \n  ', 'en')).toBe('Pravila');
    expect(pickText('  ', null, 'hr')).toBeNull();
  });

  it('hrvatsko sučelje NE pada na engleski', () => {
    // Obrnuti povrat bi hrvatskom gledatelju podmetnuo engleski tekst na
    // ekranu koji je inače cijeli na hrvatskom.
    expect(pickText(null, 'Rules', 'hr')).toBeNull();
  });

  it('nema ničega — vraća null da pozivatelj odluči', () => {
    expect(pickText(null, null, 'hr')).toBeNull();
    expect(pickText(null, null, 'en')).toBeNull();
  });

  it('tekst se obrezuje s rubova', () => {
    expect(pickText('  Pravila\n', null, 'hr')).toBe('Pravila');
  });
});

describe('hasText', () => {
  it('istina ako ijedan jezik ima sadržaj', () => {
    expect(hasText('Pravila', null)).toBe(true);
    expect(hasText(null, 'Rules')).toBe(true);
    expect(hasText('Pravila', 'Rules')).toBe(true);
  });

  it('laž kad su oba prazna ili samo razmaci', () => {
    expect(hasText(null, null)).toBe(false);
    expect(hasText('', '')).toBe(false);
    expect(hasText('  ', '\n')).toBe(false);
  });
});
