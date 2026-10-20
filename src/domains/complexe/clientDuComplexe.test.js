import {
  BAN_RAISON_MAX,
  corpsDuBan,
  etatDuBan,
  nomComplet,
} from '@/domains/complexe/clientDuComplexe';

// RESA-L5B-1 (20/10/2026) — les règles PURES de la fiche d'un client (E-G15, planche EG15 états 2 à
// 4 ; serveur RESA-L2B : `GET /complexes/:id/clients/:joueurId` rend `{ firstname, lastname,
// noShows, lateCancellations, upcoming, ban: { origin, reason, since, until } | null }`, et
// `POST /complexes/:id/bannis` lit SEULEMENT `{ joueur, reason, until?, cancelUpcoming? }`).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('RESA-L5B-1 — l’état du bannissement, en mots (bloc « Bannissement »)', () => {
  it('non banni', () => {
    expect(etatDuBan(t, null)).toBe('Non banni');
  });

  it('automatique : depuis quand, et la raison du serveur', () => {
    expect(etatDuBan(t, {
      origin: 'automatique',
      reason: '3 réservations non honorées',
      since: '2026-10-14T07:30:00.000Z',
      until: null,
    })).toBe('Banni depuis le 14/10 · automatique : 3 réservations non honorées');
  });

  it('à la main : jusqu’au dernier jour (inclus), ou depuis quand, et la raison PRIVÉE', () => {
    expect(etatDuBan(t, {
      origin: 'manuel',
      reason: 'Comportement au comptoir',
      since: '2026-10-14T07:30:00.000Z',
      until: '2026-11-30',
    })).toBe('Banni jusqu’au 30/11 · raison privée : Comportement au comptoir');
    expect(etatDuBan(t, {
      origin: 'manuel',
      reason: 'Comportement au comptoir',
      since: '2026-10-13T22:30:00.000Z',
      until: null,
    })).toBe('Banni depuis le 14/10 · raison privée : Comportement au comptoir');
  });
});

describe('RESA-L5B-1 — le corps de « Bannir » (la liste blanche du serveur)', () => {
  it('la raison nettoyée, sans fin ni case : deux champs seulement', () => {
    expect(corpsDuBan({ joueur: 'u-julien', raison: '  Comportement   au comptoir ' }))
      .toEqual({ joueur: 'u-julien', reason: 'Comportement au comptoir' });
  });

  it('« Jusqu’au » saisi en JJ/MM/AAAA part en AAAA-MM-JJ ; la case cochée part', () => {
    expect(corpsDuBan({
      annulerAVenir: true, joueur: 'u-julien', jusqua: '30/11/2026', raison: 'Retards',
    })).toEqual({
      cancelUpcoming: true, joueur: 'u-julien', reason: 'Retards', until: '2026-11-30',
    });
  });

  it('la raison ne dépasse pas la limite du serveur', () => {
    expect(BAN_RAISON_MAX).toBe(200);
    expect(corpsDuBan({ joueur: 'u', raison: 'x'.repeat(250) }).reason).toHaveLength(200);
  });
});

describe('RESA-L5B-1 — le nom (D7 : nom et prénom, jamais un numéro)', () => {
  it('prénom et nom, ou ce qu’il y a', () => {
    expect(nomComplet({ firstname: 'Julien', lastname: 'Marchal' })).toBe('Julien Marchal');
    expect(nomComplet({ firstname: 'Karim', lastname: null })).toBe('Karim');
    expect(nomComplet(null)).toBe('');
  });
});
