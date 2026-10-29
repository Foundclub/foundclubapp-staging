import {
  CARD_COMPLETION_STEP as E,
  listMissingCardSteps,
} from '@/domains/playerCard/cardCompletion';
import { extractCity, extractCityWithPostcode } from '@/domains/playerCard/cardModel';

// BIENVENUE-VILLE (29/10/2026, Q1 « A » du chef) — 12 comptes en prod ont une adresse SANS
// `city` : choisie dans nos imports de clubs (`/geo/search`, provider internal, `city: null`),
// elle ne garde qu'un libellé. La carte « Bienvenue » disait « VILLE à compléter ». La ville se
// relit alors dans le libellé, quand il porte un code postal ; sans code postal, rien n'est deviné.

describe('BIENVENUE-VILLE — la ville relue dans le libellé', () => {
  it.each([
    [{ city: null, label: 'Gardanne (13120)' }, 'Gardanne', 'Gardanne 13120'],
    [{ city: null, label: '2 RUE PASTEUR 13127 VITROLLES' }, 'Vitrolles', 'Vitrolles 13127'],
    [{ description: '11 Avenue Alphonse Daudet 13127 Vitrolles' }, 'Vitrolles', 'Vitrolles 13127'],
    [{ city: null, label: '1 RUE THEODORE RAMPAL 13380 PLAN-DE-CUQUES' }, 'Plan-de-Cuques',
      'Plan-de-Cuques 13380'],
  ])('%j ⇒ %s', (address, ville, villeEtCode) => {
    expect(extractCity(address)).toBe(ville);
    expect(extractCityWithPostcode(address)).toBe(villeEtCode);
    expect(listMissingCardSteps({ address })).not.toContain(E.CITY);
  });

  it.each([
    [{ city: null, label: '' }],
    [{ city: null, label: 'VITROLLES SPORT TIR' }],
    [{ city: null }],
  ])('%j ⇒ « à compléter », comme avant', (address) => {
    expect(extractCity(address)).toBe('');
    expect(listMissingCardSteps({ address })).toContain(E.CITY);
  });

  it('témoin : une ville connue reste telle quelle, le code postal aussi', () => {
    const address = { city: 'Aix-en-Provence', label: '3 rue X 13100 Aix', postcode: '13090' };
    expect(extractCity(address)).toBe('Aix-en-Provence');
    expect(extractCityWithPostcode(address)).toBe('Aix-en-Provence 13090');
    expect(extractCity('{"town":"Bron"}')).toBe('Bron');
    expect(extractCity('texte-libre')).toBe('');
  });
});
