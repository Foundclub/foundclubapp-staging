import {
  clientDepuis,
  HISTORIQUE_MAX,
  ligneHistorique,
  ONGLETS_CLIENTS,
  prochaineReservation,
  resumeDuClient,
} from '@/domains/complexe/clientDuComplexe';

// RESA-L5B-2 (20/10/2026) — E-G15 « Les clients » (planche EG15 états 1, 2, 6 à 8 ; plan :970-1010)
// sur le serveur RESA-L4 : `GET /complexes/:id/clients` (items[{ firstname, lastname, parties,
// noShows, fidelite{count, threshold} | null, banni, … }]) et `GET …/clients/:joueurId/historique`
// (`{ parties, reservations[50 au plus, la plus récente d'abord] }`).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('E-G15 — les règles pures de la liste et de la fiche', () => {
  it('trois onglets, dans l’ordre de la planche : Tous · Habitués · Bannis', () => {
    expect(ONGLETS_CLIENTS).toEqual(['tous', 'habitues', 'bannis']);
  });

  it('la ligne d’un client : « 12 parties · 1 non honorée · fidélité 8/10 »', () => {
    expect(resumeDuClient(t, {
      fidelite: { count: 8, threshold: 10 }, noShows: 1, parties: 12,
    })).toBe('12 parties · 1 non honorée · fidélité 8/10');
  });

  it('sans programme de fidélité, la fidélité n’est pas dite ; 0 et 1 au singulier', () => {
    expect(resumeDuClient(t, { fidelite: null, noShows: 0, parties: 2 }))
      .toBe('2 parties · 0 non honorée');
    expect(resumeDuClient(t, { noShows: 3, parties: 1 })).toBe('1 partie · 3 non honorées');
  });

  it('« Client depuis le » : la 1re réservation, seulement si l’historique est entier', () => {
    const lignes = [
      { startsAt: '2026-10-16T17:00:00.000Z' },
      { startsAt: '2026-09-02T17:00:00.000Z' },
    ];
    expect(clientDepuis(lignes)).toBe('02/09');
    // 50 lignes (le plafond du serveur) : la première réservation peut être plus ancienne.
    expect(clientDepuis(Array.from({ length: HISTORIQUE_MAX }, () => lignes[0]))).toBe('');
    expect(clientDepuis([])).toBe('');
  });

  it('« Écrire » : la prochaine réservation à venir (en attente, confirmée ou en collecte)', () => {
    const maintenant = new Date('2026-10-20T08:00:00.000Z');
    const lignes = [
      { documentId: 'r-loin', startsAt: '2026-10-30T17:00:00.000Z', status: 'confirmee' },
      { documentId: 'r-annulee', startsAt: '2026-10-21T17:00:00.000Z', status: 'annulee' },
      { documentId: 'r-proche', startsAt: '2026-10-22T17:00:00.000Z', status: 'en_attente' },
      { documentId: 'r-passee', startsAt: '2026-10-19T17:00:00.000Z', status: 'confirmee' },
    ];
    expect(prochaineReservation(lignes, maintenant)?.documentId).toBe('r-proche');
    expect(prochaineReservation([lignes[1], lignes[3]], maintenant)).toBeNull();
  });

  it('une ligne d’historique : le jour, l’heure de Paris, le terrain, et l’état lu', () => {
    const ligne = ligneHistorique({
      endsAt: '2026-10-13T18:00:00.000Z',
      noShow: true,
      startsAt: '2026-10-13T17:00:00.000Z',
      status: 'confirmee',
      terrain: { name: 'Terrain 1' },
    }, new Date('2026-10-20T08:00:00.000Z'));
    expect(ligne.texte).toMatch(/13\/10 · 19 h · Terrain 1$/);
    expect(ligne.etat).toBe('non_honoree');
    expect(ligneHistorique({
      endsAt: '2026-10-13T18:00:00.000Z',
      noShow: false,
      startsAt: '2026-10-13T17:00:00.000Z',
      status: 'confirmee',
      terrain: { name: 'Terrain 1' },
    }, new Date('2026-10-20T08:00:00.000Z')).etat).toBe('jouee');
  });
});
