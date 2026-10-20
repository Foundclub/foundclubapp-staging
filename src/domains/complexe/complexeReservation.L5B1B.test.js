import {
  historiqueLisible,
  libelleDemandeTraitee,
} from '@/domains/complexe/complexeReservation';

// RESA-L5B-1, partie B (20/10/2026, serveur RESA-L2C, contrat « Ajouté après RESA-L2C »),
// deux règles PURES : l'onglet « Traitées » des demandes (E-G06, plan :601 ; `decidedAt` et
// `reason` dans chaque élément de `vue=traitees`), et la ligne « Confirmée la veille à 18 h 12 »
// de l'historique (E-G05, plan :546 ; `history[].kind = 'confirmee-la-veille'`, servi depuis
// RESA-L2B).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('RESA-L5B-1 B1 — l’onglet « Traitées » (E-G06)', () => {
  it('« Acceptée le 14/10 » (le jour de PARIS de la décision)', () => {
    expect(libelleDemandeTraitee(t, { decidedAt: '2026-10-14T08:00:00.000Z', status: 'confirmee' }))
      .toBe('Acceptée le 14/10');
    expect(libelleDemandeTraitee(t, { decidedAt: '2026-10-13T22:30:00.000Z', status: 'confirmee' }))
      .toBe('Acceptée le 14/10');
  });

  it('« Refusée : terrain indisponible » (le motif du gérant) ; sans motif, « Refusée »', () => {
    expect(libelleDemandeTraitee(t, {
      decidedAt: '2026-10-14T08:00:00.000Z', reason: 'terrain indisponible', status: 'refusee',
    })).toBe('Refusée : terrain indisponible');
    expect(libelleDemandeTraitee(t, { decidedAt: null, reason: null, status: 'refusee' }))
      .toBe('Refusée');
  });

  it('« Sans réponse », une annulation : le libellé de l’état (rien de plus)', () => {
    expect(libelleDemandeTraitee(t, { decidedAt: null, status: 'sans_reponse' })).toBe('');
    expect(libelleDemandeTraitee(t, { decidedAt: '2026-10-14T08:00:00.000Z', status: 'annulee' }))
      .toBe('');
    expect(libelleDemandeTraitee(t, { decidedAt: null, status: 'confirmee' })).toBe('Acceptée');
  });
});

describe('RESA-L5B-1 B5 — « Confirmée la veille à 18 h 12 » (E-G05)', () => {
  it('l’heure de Paris de « Je confirme »', () => {
    expect(historiqueLisible(t, [
      { at: '2026-10-12T19:04:00.000Z', kind: 'reservee' },
      { at: '2026-10-15T16:12:00.000Z', kind: 'confirmee-la-veille' },
    ], { reserveur: 'Julien M.' })).toEqual([
      'Réservée le 12/10 à 21 h 04 dans l’app',
      'Confirmée la veille à 18 h 12',
    ]);
  });
});
