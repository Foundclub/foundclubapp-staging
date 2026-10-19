import {
  etatAffiche,
  ETATS_LUS,
  historiqueLisible,
  libelleStatut,
  nonHonoreesLisibles,
  quandCourt,
} from '@/domains/complexe/complexeReservation';

// RESA-L5B-1 (20/10/2026) — les règles PURES de « non honorée » côté gérant (plan §1.2,
// RG-NONHONOREE, E-G04, E-G05, E-G15 ; serveur RESA-L2B : `noShowAt` est une MARQUE sur une
// confirmée, `canMarkNoShow` / `canUndoNoShow` disent ce que le gérant peut faire) : l'état AFFICHÉ
// (« Non honorée », « Jouée »), le compteur « 1 non honorée sur 3 », et deux lignes d'historique
// (« Marquée non honorée par toi », « — hors délai », AT-07).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

const MAINTENANT = new Date('2026-10-14T08:00:00.000Z');

describe('RESA-L5B-1 — l’état affiché (plan §1.2)', () => {
  it('une confirmée marquée : « Non honorée »', () => {
    const marquee = {
      endsAt: '2026-10-13T18:00:00.000Z', noShowAt: '2026-10-13T19:30:00.000Z', status: 'confirmee',
    };
    expect(etatAffiche(marquee, MAINTENANT)).toBe(ETATS_LUS.nonHonoree);
    expect(libelleStatut(t, etatAffiche(marquee, MAINTENANT))).toBe('Non honorée');
  });

  it('une confirmée finie, sans marque : « Jouée » ; pas encore finie : « Confirmée »', () => {
    const finie = { endsAt: '2026-10-13T18:00:00.000Z', noShowAt: null, status: 'confirmee' };
    expect(libelleStatut(t, etatAffiche(finie, MAINTENANT))).toBe('Jouée');
    const enCours = { endsAt: '2026-10-14T09:00:00.000Z', noShowAt: null, status: 'confirmee' };
    expect(libelleStatut(t, etatAffiche(enCours, MAINTENANT))).toBe('Confirmée');
  });

  it('les autres états restent ceux du serveur', () => {
    ['annulee', 'en_attente', 'refusee', 'sans_reponse'].forEach((status) => {
      expect(etatAffiche({ endsAt: '2026-10-13T18:00:00.000Z', status }, MAINTENANT)).toBe(status);
    });
  });
});

describe('RESA-L5B-1 — « 1 non honorée sur 3 »', () => {
  it('sous le seuil du bannissement automatique', () => {
    expect(nonHonoreesLisibles(t, 0, 3)).toBe('0 non honorée sur 3');
    expect(nonHonoreesLisibles(t, 1, 3)).toBe('1 non honorée sur 3');
    expect(nonHonoreesLisibles(t, 2, 3)).toBe('2 non honorées sur 3');
  });

  it('seuil atteint, « Jamais » (0), ou seuil inconnu : le nombre seul', () => {
    expect(nonHonoreesLisibles(t, 3, 3)).toBe('3 non honorées');
    expect(nonHonoreesLisibles(t, 1, 0)).toBe('1 non honorée');
    expect(nonHonoreesLisibles(t, 2, undefined)).toBe('2 non honorées');
  });

  it('nombre inconnu : rien', () => {
    expect(nonHonoreesLisibles(t, null, 3)).toBe('');
    expect(nonHonoreesLisibles(t, undefined, 3)).toBe('');
  });
});

describe('RESA-L5B-1 — « jeudi 19 h » (la confirmation, E-G04 §4)', () => {
  it('le jour de la semaine et l’heure', () => {
    expect(quandCourt('2026-10-16', '19:00')).toBe('vendredi 19 h');
    expect(quandCourt('2026-10-15', '20:30')).toBe('jeudi 20 h 30');
  });
});

describe('RESA-L5B-1 — l’historique de la fiche (E-G05)', () => {
  it('« Marquée non honorée par toi », et « — hors délai » (AT-07)', () => {
    const lignes = historiqueLisible(t, [
      { at: '2026-10-10T19:04:00.000Z', kind: 'reservee' },
      { at: '2026-10-13T19:30:00.000Z', kind: 'non-honoree' },
    ], { reserveur: 'Julien M.' });
    expect(lignes).toEqual([
      'Réservée le 10/10 à 21 h 04 dans l’app',
      'Marquée non honorée par toi le 13/10 à 21 h 30',
    ]);
    const horsDelai = historiqueLisible(t, [
      {
        at: '2026-10-14T16:30:00.000Z', by: 'reserveur', kind: 'annulee', late: true,
      },
    ], { reserveur: 'Julien M.' });
    expect(horsDelai).toEqual(['Annulée par Julien M. le 14/10 à 18 h 30 — hors délai']);
  });
});
