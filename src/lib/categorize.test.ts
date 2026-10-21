import { describe, expect, it } from 'vitest';

import { guessCategory, pickCategory } from './categorize';

describe('guessCategory', () => {
  it('files health insurers and care under health', () => {
    expect(guessCategory('KPT Krankenkasse AG')).toBe('health');
    expect(guessCategory('Helsana Versicherungen AG')).toBe('health');
    expect(guessCategory('CSS Kranken-Versicherung AG')).toBe('health');
    expect(guessCategory('Groupe Mutuel')).toBe('health');
    expect(guessCategory('Zahnarztpraxis Dr. Meier')).toBe('health');
    expect(guessCategory('Caisse maladie')).toBe('health');
  });

  it('keeps other insurance as insurance', () => {
    expect(guessCategory('Die Mobiliar')).toBe('insurance');
    expect(guessCategory('AXA Versicherungen')).toBe('insurance');
  });

  it('knows common billers', () => {
    expect(guessCategory('Swisscom (Schweiz) AG')).toBe('telecom');
    expect(guessCategory('EWZ', 'Stromrechnung')).toBe('utilities');
    expect(guessCategory('Serafe AG')).toBe('fees');
    expect(guessCategory('Kantonales Steueramt Zürich')).toBe('taxes');
    expect(guessCategory('SBB CFF FFS')).toBe('transport');
  });

  it('matches short names only as whole words', () => {
    expect(guessCategory('Concsset GmbH')).toBeNull(); // "css" inside a word
    expect(guessCategory('Elektro Meier')).toBeNull();
  });
});

describe('pickCategory', () => {
  it('prefers what the user chose before for the biller', () => {
    expect(pickCategory({ payee: 'KPT Krankenkasse AG', model: 'insurance', learned: { kpt: 'insurance' } })).toBe('insurance');
  });
  it('trusts the model unless it says other', () => {
    expect(pickCategory({ payee: 'Acme', model: 'shopping', learned: {} })).toBe('shopping');
    expect(pickCategory({ payee: 'KPT Krankenkasse AG', model: 'other', learned: {} })).toBe('health');
    expect(pickCategory({ payee: 'Nobody', model: null, learned: {} })).toBe('other');
  });
});
