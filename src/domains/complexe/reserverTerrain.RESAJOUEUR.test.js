import {
  momentsDesCreneaux, prixDUneLigne, texteJourFerme, texteLibres,
} from '@/domains/complexe/reserverTerrain';

// RESA-JOUEUR (11/11/2026, maquette « 232- ok », piste B) : les règles pures de l'écran du terrain.
const t = (/** @type {string} */ _cle, /** @type {string} */ defaut, /** @type {any} */ v = {}) => (
  String(defaut).replace(/\{\{(\w+)\}\}/g, (_, nom) => String(v[nom]))
);

describe('momentsDesCreneaux', () => {
  it('range par moment où le créneau COMMENCE, dans l’ordre du jour, sans moment vide', () => {
    const groupes = momentsDesCreneaux(t, [
      { from: '00:30', state: 'libre' },
      { from: '11:59', state: 'pris' },
      { from: '12:00', state: 'libre' },
      { from: '17:59', state: 'libre' },
      { from: '18:00', state: 'trop-tard' },
      { from: '23:00', state: 'libre' },
    ]);
    expect(groupes.map((g) => [g.titre, g.creneaux.map((c) => c.from), g.libres])).toEqual([
      ['Nuit', ['00:30'], 1],
      ['Matin', ['11:59'], 0],
      ['Après-midi', ['12:00', '17:59'], 2],
      ['Soir', ['18:00', '23:00'], 1],
    ]);
  });

  it('rien à ranger : aucun groupe', () => {
    expect(momentsDesCreneaux(t, [])).toEqual([]);
    expect(momentsDesCreneaux(t, /** @type {any} */ (null))).toEqual([]);
  });
});

describe('les textes', () => {
  it('« 0 libre », « 1 libre », « 3 libres »', () => {
    expect([0, 1, 3].map((n) => texteLibres(t, n))).toEqual(['0 libre', '1 libre', '3 libres']);
  });

  it('le jour fermé : avec le motif du complexe, sinon la phrase d’avant', () => {
    expect(texteJourFerme(t, [{ closureLabel: '' }, { closureLabel: 'Travaux' }]))
      .toBe('Fermé ce jour-là : Travaux');
    expect(texteJourFerme(t, [{}])).toBe('Fermé ce jour-là : le complexe a fermé ce terrain.');
  });

  it('le prix d’une ligne : le montant, ou rien', () => {
    expect(prixDUneLigne({ amount: 60 })).toMatch(/^60\s€$/);
    expect(prixDUneLigne({ amount: null })).toBe('');
    expect(prixDUneLigne(null)).toBe('');
  });
});
