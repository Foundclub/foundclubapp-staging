import renderer, { act } from 'react-test-renderer';

import ComplexeInstallations from '@/views/complexe/ComplexeInstallations';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G07 « Mes installations » (planche EG07, P00 bloc 5) : une carte par
// terrain (mode, prix indicatif, horaires ou « Aucun créneau ouvert »), le « + », le menu « … »,
// l'état vide, le chargement, l'erreur.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockTerrains = /** @type {any} */ ({});
const mockRetirer = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuRetrait: () => ({
    isPending: false,
    mutateAsync: async () => ({ data: { dryRun: true, reservationsTouchees: 4 } }),
  }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useRetirerTerrain: () => ({ isPending: false, mutateAsync: mockRetirer }),
  useTerrains: () => mockTerrains,
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
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

const refetch = jest.fn();

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeInstallations />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTerrains = {
    data: [
      terrainDeTemoin({ slotPlan: PLAN_OUVERT }),
      terrainDeTemoin({ bookingMode: 'manuel', documentId: 't-2', name: 'Terrain 2' }),
      terrainDeTemoin({
        basePrice: 24,
        bookingMode: 'telephone',
        capacity: 4,
        documentId: 't-3',
        isBookable: false,
        name: 'Padel A',
        sport: { documentId: 'a-padel', name: 'Padel' },
      }),
    ],
    isLoading: false,
    refetch,
  };
});

describe('RESA-L5A1 E-G07 — trois terrains (état 1)', () => {
  it('l’en-tête, le compte, une carte par terrain avec son mode', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'MES INSTALLATIONS',
      '3 terrains',
      'Terrain 1',
      'Automatique',
      'Ouvert : lun-ven 17 h – 23 h, sam-dim 9 h – 22 h',
      'Terrain 2',
      'Validation manuelle',
      'Aucun créneau ouvert',
      'Padel A',
      'Padel · Extérieur · 4 joueurs',
      'Téléphone seulement',
      'Pas réservable',
    ]));
    expect(parRepere(arbre, 'carte-terrain-t-1')).not.toBeNull();
  });

  it('« + » ouvre une fiche vide ; une carte ouvre sa fiche', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un terrain');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeTerrain, {
      complexeId: 'cx-five',
    });
    await appuyer(arbre, 'Terrain 2 : ouvrir la fiche');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeTerrain, {
      complexeId: 'cx-five',
      terrainId: 't-2',
    });
  });

  it('le menu « … » : « Créneaux » ouvre les créneaux du terrain', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Plus d’actions : Terrain 1');
    expect(lisibles(arbre)).toContain('Créneaux');
    await appuyer(arbre, 'Créneaux');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeCreneaux, {
      complexeId: 'cx-five',
      terrainId: 't-1',
    });
  });
});

describe('RESA-L5A1 E-G07 — vide, chargement, erreur (états 4 et 5)', () => {
  it('vide : « Tu n’as pas encore de terrain. » et « Ajouter un terrain »', async () => {
    mockTerrains = { ...mockTerrains, data: [] };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Tu n’as pas encore de terrain.');
    await appuyer(arbre, 'Ajouter un terrain');
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.ComplexeTerrain, { complexeId: 'cx-five' });
  });

  it('chargement : le squelette', async () => {
    mockTerrains = { ...mockTerrains, data: undefined, isLoading: true };
    expect(parRepere(await monter(), 'complexe-installations-squelette')).not.toBeNull();
  });

  it('erreur : « Impossible de charger tes terrains. » et « Réessayer »', async () => {
    mockTerrains = {
      ...mockTerrains, data: undefined, error: new Error('boum'), isLoading: false,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger tes terrains.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A2 E-G07 — le menu « … » complet (Fermetures, Voir le planning, Retirer)', () => {
  beforeEach(() => {
    mockRetirer.mockResolvedValue({ data: { reservationsAnnulees: 4, retired: true } });
  });

  it('« Fermetures » et « Voir le planning » ouvrent E-G10 et E-G03 pour ce terrain', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Plus d’actions : Terrain 1');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Créneaux', 'Fermetures', 'Voir le planning', 'Retirer',
    ]));
    await appuyer(arbre, 'Fermetures');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeFermetures, {
      complexeId: 'cx-five', terrainId: 't-1',
    });
    await appuyer(arbre, 'Plus d’actions : Terrain 1');
    await appuyer(arbre, 'Voir le planning');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeEspace, {
      params: { complexeId: 'cx-five', terrainId: 't-1' },
      screen: RouteNames.ComplexePlanning,
    });
  });

  it('« Retirer » : le compte des réservations à venir, puis le retrait (N-18)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Plus d’actions : Terrain 1');
    await appuyer(arbre, 'Retirer');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Retirer Terrain 1 ?',
      '4 réservations à venir seront annulées et les joueurs prévenus.',
    ]));
    const confirmer = parRepere(arbre, 'retrait-confirmer')
      .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
    await act(async () => {
      await confirmer.props.onPress();
    });
    expect(mockRetirer).toHaveBeenCalledWith({ complexeId: 'cx-five', terrainId: 't-1' });
    expect(lisibles(arbre))
      .toContain('Terrain 1 est retiré. 4 réservations annulées, les joueurs sont prévenus.');
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2 : « Terrain Test 4 est retiré. 0 réservation annulée, le
// joueur est prévenu. » — la phrase ne connaissait pas le cas zéro (personne n'est prévenu).
describe('RESA-FIN-APP (3) E-G07 — retirer un terrain sans réservation à venir', () => {
  it('« … est retiré. Aucune réservation à annuler. »', async () => {
    mockRetirer.mockResolvedValue({ data: { reservationsAnnulees: 0, retired: true } });
    const arbre = await monter();
    await appuyer(arbre, 'Plus d’actions : Terrain 1');
    await appuyer(arbre, 'Retirer');
    const confirmer = parRepere(arbre, 'retrait-confirmer')
      .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
    await act(async () => {
      await confirmer.props.onPress();
    });
    expect(lisibles(arbre)).toContain('Terrain 1 est retiré. Aucune réservation à annuler.');
    expect(lisibles(arbre).some((texte) => texte.includes('prévenu'))).toBe(false);
  });
});
