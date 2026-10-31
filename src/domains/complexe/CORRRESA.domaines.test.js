import { peutPartagerLAnnonce } from '@/domains/complexe/annonceDuCanal';
import { clientDepuisLaFiche } from '@/domains/complexe/clientDuComplexe';
import {
  nonHonoreesLisibles,
  terrainsAvecReservations,
} from '@/domains/complexe/complexeReservation';
import { contenuDEchec, varianteDeLaReservation } from '@/domains/complexe/reserverTerrain';

// CORR-RESA (31/10/2026) — les règles PURES des décisions d'Adel sur la réservation (feuille de
// référence du 30/10, thème G) : 69 (collecte arrêtée par le retrait du terrain), 73 (terrains
// occupés de la semaine), 75 (« Client depuis »), 79 (« ban auto à 3 »), 115 (partager une
// collecte).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('69 A — une collecte arrêtée parce que le terrain est retiré', () => {
  it('le motif `terrain_retire` ou la notification N-23 donnent « Collecte arrêtée »', () => {
    const reservation = { role: 'reserveur', status: 'non_aboutie' };
    expect(varianteDeLaReservation(reservation, { echecDeCollecte: 'terrain_retire' }))
      .toBe('collecteTerrainRetire');
    expect(varianteDeLaReservation(reservation, { change: 'collecte-terrain-retire' }))
      .toBe('collecteTerrainRetire');
    const contenu = contenuDEchec(t, 'collecteTerrainRetire');
    expect([contenu.titre, contenu.texte]).toEqual([
      'Collecte arrêtée',
      'Le complexe a retiré ce terrain : ta collecte s’arrête, rien n’est réservé.',
    ]);
  });

  it('un créneau pris garde son motif, une date limite aussi', () => {
    const reservation = { status: 'non_aboutie' };
    expect(varianteDeLaReservation(reservation, { echecDeCollecte: 'creneau_pris' }))
      .toBe('collectePrise');
    expect(varianteDeLaReservation(reservation, { echecDeCollecte: 'delai' }))
      .toBe('collecteDelai');
  });
});

describe('73 A — les terrains qui ont des réservations dans la semaine', () => {
  it('seuls les terrains dont un créneau porte une réservation', () => {
    const planning = {
      terrains: [
        { days: [{ slots: [{ reservation: null, state: 'libre' }] }], documentId: 't-1' },
        {
          days: [
            { slots: [] },
            { slots: [{ reservation: { documentId: 'r' }, state: 'reserve-app' }] },
          ],
          documentId: 't-2',
        },
      ],
    };
    expect([...terrainsAvecReservations(planning)]).toEqual(['t-2']);
    expect([...terrainsAvecReservations(undefined)]).toEqual([]);
  });
});

describe('75 A — « Client depuis le … »', () => {
  it('la date de la fiche (où il a réservé), pas celle du créneau de l’historique', () => {
    const historique = [{ startsAt: '2026-11-03T17:00:00.000Z' }];
    expect(clientDepuisLaFiche({ clientDepuis: '2026-10-05T09:00:00.000Z' }, historique))
      .toBe('05/10');
    expect(clientDepuisLaFiche({ clientDepuis: null }, historique)).toBe('');
  });

  it('un serveur d’avant (champ absent) : l’ancienne règle', () => {
    expect(clientDepuisLaFiche({}, [{ startsAt: '2026-11-03T17:00:00.000Z' }])).toBe('03/11');
  });
});

describe('79 A — le compteur de non honorées dit le seuil du ban automatique', () => {
  it('« 0 non honorée (ban auto à 3) », « 2 non honorées (ban auto à 3) »', () => {
    expect(nonHonoreesLisibles(t, 0, 3)).toBe('0 non honorée (ban auto à 3)');
    expect(nonHonoreesLisibles(t, 2, 3)).toBe('2 non honorées (ban auto à 3)');
  });

  it('le seuil atteint, ou sans seuil : le nombre seul', () => {
    expect(nonHonoreesLisibles(t, 3, 3)).toBe('3 non honorées');
    expect(nonHonoreesLisibles(t, 1, 0)).toBe('1 non honorée');
  });
});

describe('115 A — partager l’annonce d’une collecte', () => {
  const MAINTENANT = Date.parse('2026-10-20T08:00:00.000Z');
  const demain = '2026-10-21T17:00:00.000Z';

  it('une collecte de l’app, à venir, avec son annonce ouverte : oui', () => {
    expect(peutPartagerLAnnonce({
      annonce: { status: 'ouverte' }, source: 'app', startsAt: demain, status: 'en_collecte',
    }, MAINTENANT)).toBe(true);
  });

  it('une collecte non aboutie, une réservation extérieure, une annonce fermée : non', () => {
    expect(peutPartagerLAnnonce({
      annonce: { status: 'ouverte' }, source: 'app', startsAt: demain, status: 'non_aboutie',
    }, MAINTENANT)).toBe(false);
    expect(peutPartagerLAnnonce({
      annonce: { status: 'ouverte' }, source: 'exterieur', startsAt: demain, status: 'confirmee',
    }, MAINTENANT)).toBe(false);
    expect(peutPartagerLAnnonce({
      annonce: { status: 'fermee' }, source: 'app', startsAt: demain, status: 'en_collecte',
    }, MAINTENANT)).toBe(false);
  });
});
