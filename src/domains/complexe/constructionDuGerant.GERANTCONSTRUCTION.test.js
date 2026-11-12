/* eslint-disable max-len -- témoin de GERANT-CONSTRUCTION : libellés de cas et attentes longs (récolte T10, lint au plafond) */
import {
  etatDuCreneau, libelleDuCreneau, lignesDeLaFrise,
} from '@/domains/complexe/complexeReservation';
import {
  evolutionDeLaConstruction, texteDuCompteur, texteDuManque,
} from '@/domains/complexe/constructionDuGerant';
import { destinationDuGerant, iconeDuGerant } from '@/domains/complexe/notificationsDuComplexe';

// GERANT-CONSTRUCTION (11/11/2026, D50) — la réservation « en construction » vue par le gérant :
// le créneau reste « libre » côté serveur (un autre groupe peut le prendre) et porte
// `construction` ; la frise et le planning le hachurent et le touchent vers la fiche.

jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_GERANT', { enumerable: true, get: () => true });
  return doublure;
});

const t = (/** @type {string} */ _cle, /** @type {any} */ defautOuOptions, /** @type {any} */ suite) => {
  const options = typeof defautOuOptions === 'object' ? defautOuOptions : suite;
  let texte = typeof defautOuOptions === 'string' ? defautOuOptions : '';
  if (options && typeof options.count === 'number') {
    texte = options.count > 1 ? (options.defaultValue_other || texte) : (options.defaultValue_one || texte);
  }
  return texte.replace(/\{\{(\w+)\}\}/g, (_m, nom) => String(options?.[nom] ?? ''));
};

const CONSTRUCTION = {
  documentId: 'r-c1', label: 'Sarah K.', presents: 7, quorum: 10,
};

describe('GERANT-CONSTRUCTION — le créneau en construction', () => {
  it('un créneau libre qui porte `construction` est « construction » ; une réservation tenue garde son état', () => {
    expect(etatDuCreneau({ construction: CONSTRUCTION, state: 'libre' })).toBe('construction');
    expect(etatDuCreneau({ state: 'libre' })).toBe('libre');
    expect(etatDuCreneau({ construction: CONSTRUCTION, state: 'reserve-app' })).toBe('app');
  });

  it('la grille et la liste du planning disent « Sarah K. · En construction »', () => {
    expect(libelleDuCreneau(t, { construction: CONSTRUCTION, state: 'libre' })).toBe('Sarah K. · En construction');
    expect(libelleDuCreneau(t, { state: 'libre' })).toBe('Libre');
  });

  it('la frise du jour : hachurée, son libellé, et la toucher ouvre la fiche de la réservation', () => {
    const planning = {
      terrains: [{
        days: [{
          date: '2026-10-14',
          slots: [
            {
              construction: CONSTRUCTION,
              endsAt: '2026-10-14T20:00:00.000Z',
              from: '21:00',
              reservation: null,
              startsAt: '2026-10-14T19:00:00.000Z',
              state: 'libre',
              to: '22:00',
            },
            {
              endsAt: '2026-10-14T21:00:00.000Z',
              from: '22:00',
              reservation: null,
              startsAt: '2026-10-14T20:00:00.000Z',
              state: 'libre',
              to: '23:00',
            },
          ],
        }],
        documentId: 't-1',
        name: 'Terrain 1',
      }],
    };
    const [ligne] = lignesDeLaFrise(t, planning, '2026-10-14');
    expect(ligne.creneaux.map((/** @type {any} */ c) => [c.etat, c.libelle, c.reservationId])).toEqual([
      ['construction', 'Sarah K. · En construction', 'r-c1'],
      ['libre', undefined, null],
    ]);
  });
});

describe('GERANT-CONSTRUCTION — la jauge et l’évolution', () => {
  it('« 7 sur 10 » et « Ils cherchent 3 joueurs » (1 joueur au singulier, rien s’il ne manque personne)', () => {
    expect(texteDuCompteur(t, { presents: 7, quorum: 10 })).toBe('7 sur 10');
    expect(texteDuManque(t, { manque: 3 })).toBe('Ils cherchent 3 joueurs');
    expect(texteDuManque(t, { manque: 1 })).toBe('Ils cherchent 1 joueur');
    expect(texteDuManque(t, { manque: 0 })).toBe('');
  });

  it('l’évolution, la plus récente d’abord : qui vient (et par où), les joueurs trouvés hors de l’app, la création', () => {
    const lignes = evolutionDeLaConstruction(t, {
      booker: { firstname: 'Julien', lastname: 'Marchal' },
      construction: {
        createdAt: '2026-10-14T13:26:00.000Z',
        externalPlayers: 2,
        participants: [
          { label: 'Karim B.', respondedAt: '2026-10-14T14:10:00.000Z', via: 'lien' },
          { label: 'Inès R.', respondedAt: '2026-10-14T15:02:00.000Z', via: 'annonce' },
        ],
      },
    });
    expect(lignes.map((ligne) => [ligne.titre, ligne.detail])).toEqual([
      ['Inès R. vient', 'par l’annonce · 14/10 à 17 h 02'],
      ['Karim B. vient', 'par le lien · 14/10 à 16 h 10'],
      ['2 joueurs trouvés hors de l’app', ''],
      ['Réservation créée en construction', 'par Julien M. · 14/10 à 15 h 26'],
    ]);
  });
});

describe('GERANT-CONSTRUCTION — les notifications', () => {
  it('« construction » et « construction-evolution » ouvrent la fiche de la réservation, avec l’horloge', () => {
    ['construction', 'construction-evolution'].forEach((change) => {
      expect(destinationDuGerant({ change, complexeId: 'cx-five', reservationId: 'r-c1' })?.route).toBe('ComplexeReservation');
      expect(iconeDuGerant('complexeReservationGerant', { change })).toBe('clock-two-thirty');
    });
  });
});
