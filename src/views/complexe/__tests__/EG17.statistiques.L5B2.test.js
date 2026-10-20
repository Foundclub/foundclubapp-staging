import renderer, { act } from 'react-test-renderer';

import ComplexeStatistiques from '@/views/complexe/ComplexeStatistiques';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G17 « Statistiques » V1 (planche EG17-EG18 états 1 à 3 ; plan
// :1053-1087 ; RC-G12) sur le serveur RESA-L4 (`GET /complexes/:id/chiffres?periode`,
// `GET …/chiffres/export`) : la période (Semaine · Mois · Saison), « OCCUPATION » (le complexe
// et chaque terrain, « — » sans horaires), « RÉSERVATIONS » (app, extérieures, annulées dont hors
// délai, non honorées), « FAVORIS », « CLIENTS FIDÈLES » (vers leur fiche), « PAR HEURE » (V2),
// « Exporter (CSV) ». Période vide, chargement, erreur.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

/** @type {string[]} */
const mockPeriodes = [];
let mockLecture = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useChiffresDuComplexe: (/** @type {any} */ _id, /** @type {string} */ periode) => {
    mockPeriodes.push(periode);
    return mockLecture;
  },
  useComplexeChoisi: (/** @type {any} */ complexeId) => ({
    complexe: { documentId: complexeId, name: 'Le Five de Montrivage', slug: 'le-five' },
    complexeId,
    mes: { data: [], isLoading: false },
  }),
}));
const mockExport = jest.fn();
jest.mock('@/services/complexe/complexeService', () => ({
  lireExportChiffres: (/** @type {any[]} */ ...args) => mockExport(...args),
}));
const mockEnregistrer = jest.fn();
jest.mock('@/platform/media/saveTextFile', () => ({
  saveTextFile: (/** @type {any} */ fichier) => mockEnregistrer(fichier),
}));

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  jest.requireActual('@/testSupport/temoinComplexe').ongletsDeTemoin()
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const CHIFFRES = {
  clientsFideles: [
    { documentId: 'u-julien', nom: 'Julien M.', parties: 12 },
    { documentId: 'u-karim', nom: 'Karim B.', parties: 9 },
  ],
  favoris: { nouveaux: 27, total: 214 },
  fidelite: { enAttente: 1, validees: 3 },
  from: '2026-10-01',
  occupation: {
    capaciteMinutes: 1000,
    minutes: 720,
    taux: 72,
    terrains: [
      { documentId: 't-1', name: 'Terrain 1', taux: 81 },
      { documentId: 't-2', name: 'Terrain 2', taux: null },
    ],
  },
  periode: 'mois',
  reservations: {
    annulees: 12, annuleesHorsDelai: 3, app: 164, exterieur: 41, nonHonorees: 4,
  },
  to: '2026-10-31',
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeStatistiques />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPeriodes.length = 0;
  mockLecture = { data: CHIFFRES, isLoading: false, refetch: jest.fn() };
  mockExport.mockResolvedValue('Date;Début\r\n');
  mockEnregistrer.mockResolvedValue(undefined);
});

describe('E-G17 — les statistiques du complexe', () => {
  it('les blocs V1 de la planche, dans l’ordre (état 1)', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    const rang = (/** @type {string} */ texte) => vus.indexOf(texte);
    const blocs = ['OCCUPATION', 'RÉSERVATIONS', 'FAVORIS', 'CLIENTS FIDÈLES', 'PAR HEURE · V2'];
    blocs.forEach((bloc) => expect(rang(bloc)).toBeGreaterThan(-1));
    blocs.slice(1).forEach((bloc, i) => expect(rang(bloc)).toBeGreaterThan(rang(blocs[i])));
    expect(vus).toEqual(expect.arrayContaining([
      'Semaine', 'Mois', 'Saison', '72 %', 'Terrain 1', '81 %', 'Terrain 2', '—',
      '164 faites dans l’app', '41 extérieures', '12 annulées, dont 3 hors délai',
      '4 non honorées', '214 au total', '27 nouveaux sur la période', 'Julien M.', '12 parties',
    ]));
    expect(vus).toContain('Pas d’horaires : ouvre ses créneaux pour calculer le taux.');
    expect(mockPeriodes.at(-1)).toBe('semaine');
  });

  it('changer la période relit les chiffres ; un client fidèle ouvre sa fiche', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Mois').props.onPress();
    });
    expect(mockPeriodes.at(-1)).toBe('mois');
    await act(async () => {
      pressable(arbre, 'Julien M.').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeClient, {
      complexeId: 'cx-five', joueurId: 'u-julien',
    });
  });

  it('« Exporter (CSV) » : le fichier du serveur, avec sa marque UTF-8', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Exporter (CSV)').props.onPress();
    });
    expect(mockExport).toHaveBeenCalledWith('cx-five', 'semaine');
    expect(mockEnregistrer).toHaveBeenCalledWith({
      contenu: '﻿Date;Début\r\n',
      fileName: 'statistiques-le-five-semaine-2026-10-01.csv',
      mimeType: 'text/csv',
    });
    expect(lisibles(arbre)).toContain('Fichier enregistré.');
  });

  it('période vide : « Pas encore de réservations sur cette période. » (état 2)', async () => {
    mockLecture = {
      data: {
        ...CHIFFRES,
        clientsFideles: [],
        reservations: {
          annulees: 0, annuleesHorsDelai: 0, app: 0, exterieur: 0, nonHonorees: 0,
        },
      },
      isLoading: false,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Pas encore de réservations sur cette période.');
  });

  it('chargement : le squelette ; erreur : « Impossible de calculer tes chiffres. »', async () => {
    mockLecture = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'stats-squelette')).not.toBeNull();
    mockLecture = {
      data: undefined, error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de calculer tes chiffres.');
    await act(async () => {
      pressable(arbre, 'Réessayer').props.onPress();
    });
    expect(mockLecture.refetch).toHaveBeenCalled();
  });
});
