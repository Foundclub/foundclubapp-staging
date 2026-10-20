import renderer, { act } from 'react-test-renderer';

import AdminComplexeList from '@/views/admin/AdminComplexeList';
import FicheComplexeConsole from '@/views/admin/components/FicheComplexeConsole';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles, parRepere, pressable,
} from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-S01, LA CONSOLE DES COMPLEXES DU SUPERADMIN (planche ES01, plan
// :1806-1850, serveur RESA-L4 /superadmin/complexes) : la liste (onglets « À traiter (2) » ·
// « Tous » · « Suspendus », pastilles, « Rien à traiter. »), la fiche (identité, gérant et son
// compte, terrains et réservations, signalements, journal) et ses gestes : « Signalement traité »,
// « Marquer vérifié », « Suspendre » (motif obligatoire), « Réactiver », « Retirer » (définitif,
// réservations à venir annulées). Sur ordinateur, la fiche s'ouvre dans le volet de droite.

jest.setTimeout(30000);

let mockLargeur = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

/** @type {any[]} */
const mockListes = [];
let mockListe = /** @type {any} */ ({});
let mockFiche = /** @type {any} */ ({});
/** @type {any[]} */
const mockFiches = [];
const mockGeste = jest.fn();
// La liste lit par pages (« Voir plus ») : la première est `mockListe`, les suivantes ici.
/** @type {any[]} */
const mockPagesSuivantes = [];
let mockEncore = false;
const mockPageSuivante = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeDeLaConsole: (/** @type {string} */ complexeId) => {
    mockFiches.push(complexeId);
    return mockFiche;
  },
  useConsoleDesComplexes: (/** @type {string} */ onglet, /** @type {string} */ recherche) => {
    mockListes.push([onglet, recherche]);
    return mockListe;
  },
  useGesteDeLaConsole: () => ({ isPending: false, mutateAsync: mockGeste }),
  usePagesDeLaConsole: (/** @type {string} */ onglet, /** @type {string} */ recherche) => {
    mockListes.push([onglet, recherche]);
    return {
      ...mockListe,
      data: mockListe.data ? { pages: [mockListe.data, ...mockPagesSuivantes] } : undefined,
      fetchNextPage: mockPageSuivante,
      hasNextPage: mockEncore,
    };
  },
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
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

const LISTE = {
  compteurs: { aTraiter: 2, suspendus: 0, tous: 3 },
  items: [
    {
      city: 'Montrivage',
      createdAt: '2026-10-13T08:00:00.000Z',
      documentId: 'cx-five',
      logo: null,
      name: 'Le Five de Montrivage',
      nouveau: true,
      signalementsATraiter: 2,
      status: 'actif',
    },
    {
      city: 'Valbrune',
      createdAt: '2026-10-12T08:00:00.000Z',
      documentId: 'cx-padel',
      logo: null,
      name: 'Padel Club Valbrune',
      nouveau: true,
      signalementsATraiter: 0,
      status: 'actif',
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 2 },
};

const FICHE = {
  complexe: {
    city: 'Montrivage',
    createdAt: '2026-10-13T08:00:00.000Z',
    documentId: 'cx-five',
    logo: null,
    name: 'Le Five de Montrivage',
    slug: 'le-five-de-montrivage',
    status: 'actif',
    verified: false,
  },
  gerants: [{
    bloque: false, documentId: 'u-sofia', firstname: 'Sofia', lastname: 'Leroy',
  }],
  journal: [],
  reservations: { aVenir: 12, total: 164 },
  signalements: [
    {
      auteur: { documentId: 'u-noah', firstname: 'Noah', lastname: 'Roux' },
      createdAt: '2026-10-13T19:10:00.000Z',
      details: null,
      documentId: 's-1',
      motif: 'inexistant',
      motifLabel: 'Ce complexe n\'existe pas',
      status: 'a_traiter',
    },
    {
      auteur: { documentId: 'u-theo', firstname: 'Théo', lastname: 'Lenoir' },
      createdAt: '2026-10-13T20:40:00.000Z',
      details: null,
      documentId: 's-2',
      motif: 'informations-fausses',
      motifLabel: 'Informations fausses',
      status: 'traite',
    },
  ],
  terrains: [{ documentId: 't-1' }, { documentId: 't-2' }, { documentId: 't-3' }],
};

const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

const ecrireLeMotif = async (/** @type {any} */ arbre, /** @type {string} */ motif) => {
  const saisie = arbre.root.find((/** @type {any} */ noeud) => (
    noeud.props?.accessibilityLabel === 'Motif' && typeof noeud.props?.onChangeText === 'function'
  ));
  await act(async () => {
    saisie.props.onChangeText(motif);
  });
};

/**
 * Le bouton de confirmation, dans sa boîte repérée (le bouton de l'app ne porte pas de repère).
 * @param {any} arbre - L'arbre.
 * @returns {any} Le bouton.
 */
const confirmer = (arbre) => parRepere(arbre, 'console-confirmer-geste').findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function' && noeud.props?.title,
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLargeur = 390;
  mockListes.length = 0;
  mockFiches.length = 0;
  mockPagesSuivantes.length = 0;
  mockEncore = false;
  mockListe = { data: LISTE, isLoading: false, refetch: jest.fn() };
  mockFiche = { data: FICHE, isLoading: false, refetch: jest.fn() };
  mockGeste.mockResolvedValue({ data: {} });
});

describe('E-S01 — la liste des complexes', () => {
  it('« À traiter » d’abord, les pastilles, une ligne ouvre sa fiche', async () => {
    const arbre = await monter(<AdminComplexeList />);
    const vus = lisibles(arbre);
    expect(mockListes[0]).toEqual(['a-traiter', '']);
    expect(vus).toEqual(expect.arrayContaining([
      'CONSOLE', 'Complexes', 'À traiter (2)', 'Tous', 'Suspendus',
      'Le Five de Montrivage', 'Montrivage · créé le 13/10', '2 signalements', 'Nouveau',
      'Padel Club Valbrune', 'Valbrune · créé le 12/10',
    ]));
    await appuyer(arbre, 'Le Five de Montrivage');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminComplexeDetail, {
      complexeId: 'cx-five',
    });
  });

  it('les onglets relisent le serveur ; « Rien à traiter. », l’erreur', async () => {
    const arbre = await monter(<AdminComplexeList />);
    await appuyer(arbre, 'Suspendus');
    expect(mockListes[mockListes.length - 1]).toEqual(['suspendus', '']);
    mockListe = { data: { ...LISTE, items: [] }, isLoading: false, refetch: jest.fn() };
    await appuyer(arbre, 'À traiter');
    expect(lisibles(arbre)).toContain('Rien à traiter.');
    mockListe = {
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    };
    await appuyer(arbre, 'Tous');
    expect(lisibles(arbre)).toContain('Impossible de charger les complexes.');
  });

  it('sur ordinateur : la fiche s’ouvre dans le volet de droite, la liste reste', async () => {
    mockLargeur = 1360;
    const arbre = await monter(<AdminComplexeList />);
    expect(lisibles(arbre)).toContain('Choisis un complexe dans la liste pour voir sa fiche.');
    // Le tableau de la planche (état 1) : ses colonnes, une rangée par complexe.
    expect(parRepere(arbre, 'console-tableau')).not.toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Complexe', 'Ville', 'Créé le', 'État', 'Montrivage', '13/10', 'Valbrune', '12/10',
    ]));
    await appuyer(arbre, 'Le Five de Montrivage');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockFiches).toContain('cx-five');
    expect(parRepere(arbre, 'console-fiche')).not.toBeNull();
  });

  it('« Voir plus » lit la page suivante ; la dernière page n’en propose plus', async () => {
    mockEncore = true;
    let arbre = await monter(<AdminComplexeList />);
    await appuyer(arbre, 'Voir plus');
    expect(mockPageSuivante).toHaveBeenCalled();
    mockEncore = false;
    mockPagesSuivantes.push({
      items: [{
        city: 'Lunel',
        createdAt: '2026-10-01T08:00:00.000Z',
        documentId: 'cx-21',
        logo: null,
        name: 'Urban 21',
        nouveau: false,
        signalementsATraiter: 0,
        status: 'actif',
      }],
      pagination: { page: 2, pageSize: 20, total: 21 },
    });
    arbre = await monter(<AdminComplexeList />);
    expect(lisibles(arbre)).toContain('Urban 21');
    expect(parRepere(arbre, 'console-voir-plus')).toBeNull();
  });
});

describe('E-S01 — la fiche d’un complexe et ses gestes', () => {
  it('l’identité, le gérant et son compte, les chiffres, signalements et journal', async () => {
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Le Five de Montrivage', 'Montrivage · créé le 13/10 · actif, non vérifié',
      'GÉRANT', 'Sofia L.', 'voir le compte', '3 terrains · 164 réservations · 12 à venir',
      'SIGNALEMENTS', 'Ce complexe n\'existe pas', 'À traiter', 'Par Noah R. · 13/10 à 21 h 10',
      'Informations fausses', 'Traité', 'JOURNAL', 'Créé le 13/10, sans validation',
    ]));
    await appuyer(arbre, 'voir le compte');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.SuperAdminEntryDetail,
      expect.objectContaining({ documentId: 'u-sofia', uid: 'plugin::users-permissions.user' }),
    );
    // Un seul « Signalement traité » : le second l'est déjà.
    expect(parRepere(arbre, 'console-traiter-s-1')).not.toBeNull();
    expect(parRepere(arbre, 'console-traiter-s-2')).toBeNull();
    await appuyer(arbre, 'Signalement traité');
    expect(mockGeste).toHaveBeenCalledWith({
      complexeId: 'cx-five', geste: 'traiter', signalementId: 's-1',
    });
    expect(lisibles(arbre)).toContain('Signalement traité.');
  });

  it('« Suspendre » : un motif de 3 caractères au moins, puis le bandeau', async () => {
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    await appuyer(arbre, 'Suspendre');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Suspendre Le Five de Montrivage ?',
      'Il n’apparaîtra plus dans l’app ni sur le site. Ses réservations à venir sont gardées.',
    ]));
    expect(confirmer(arbre).props.disabled).toBe(true);
    await ecrireLeMotif(arbre, 'ab');
    expect(confirmer(arbre).props.disabled).toBe(true);
    await ecrireLeMotif(arbre, 'Vérification en cours');
    expect(confirmer(arbre).props.disabled).toBe(false);
    await act(async () => {
      await confirmer(arbre).props.onPress();
    });
    expect(mockGeste).toHaveBeenCalledWith({
      complexeId: 'cx-five', geste: 'suspendre', motif: 'Vérification en cours',
    });
    expect(lisibles(arbre)).toContain('Le Five de Montrivage est suspendu : il n’apparaît plus.');
  });

  it('« Retirer » : la confirmation forte nomme les réservations annulées', async () => {
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    await appuyer(arbre, 'Retirer');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Retirer définitivement ?',
      'Ses 12 réservations à venir seront annulées et les joueurs prévenus.',
    ]));
    await ecrireLeMotif(arbre, 'Complexe inexistant');
    await act(async () => {
      await confirmer(arbre).props.onPress();
    });
    expect(mockGeste).toHaveBeenCalledWith({
      complexeId: 'cx-five', geste: 'retirer', motif: 'Complexe inexistant',
    });
    expect(lisibles(arbre)).toContain('Le Five de Montrivage est retiré de FoundClub.');
  });

  it('« Marquer vérifié » ; suspendu : « Réactiver » ; retiré : plus aucun geste', async () => {
    let arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    await appuyer(arbre, 'Marquer vérifié');
    expect(mockGeste).toHaveBeenLastCalledWith({
      complexeId: 'cx-five', geste: 'verifier', verified: true,
    });
    mockFiche = {
      data: { ...FICHE, complexe: { ...FICHE.complexe, status: 'suspendu' } }, isLoading: false,
    };
    arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    expect(lisibles(arbre)).not.toContain('Suspendre');
    await appuyer(arbre, 'Réactiver');
    expect(mockGeste).toHaveBeenLastCalledWith({ complexeId: 'cx-five', geste: 'reactiver' });
    expect(lisibles(arbre)).toContain('Le Five de Montrivage est visible à nouveau.');
    mockFiche = {
      data: { ...FICHE, complexe: { ...FICHE.complexe, status: 'retire' } }, isLoading: false,
    };
    arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    const gestes = parRepere(arbre, 'console-gestes');
    expect(gestes.findAll((/** @type {any} */ noeud) => noeud.props?.title)).toHaveLength(0);
  });

  it('un refus du serveur se dit, sans fermer la confirmation', async () => {
    mockGeste.mockRejectedValueOnce(new Error('409'));
    const arbre = await monter(<FicheComplexeConsole complexeId="cx-five" />);
    await appuyer(arbre, 'Suspendre');
    await ecrireLeMotif(arbre, 'Vérification');
    await act(async () => {
      await confirmer(arbre).props.onPress();
    });
    expect(lisibles(arbre)).toContain('Le geste n’a pas abouti. Réessaie.');
    expect(parRepere(arbre, 'console-confirmer')).not.toBeNull();
  });
});

describe('E-S01 — la tuile « Complexes » du dashboard', () => {
  /**
   * Ce que rend la tuile, lu par un composant d'essai.
   * @returns {Promise<any>} La tuile.
   */
  const lireLaTuile = async () => {
    // eslint-disable-next-line global-require
    const useComplexesTile = require('@/views/admin/components/useComplexesTile').default;
    /** @type {any} */
    let tuile;
    /**
     * Lit la tuile dans un rendu.
     * @returns {null} Rien à l'écran.
     */
    function Sonde() {
      tuile = useComplexesTile();
      return null;
    }
    await monter(<Sonde />);
    return tuile;
  };

  it('le nombre de complexes, « 2 à traiter » en orange ; « Rien à traiter » ; « — »', async () => {
    let tuile = await lireLaTuile();
    expect(mockListes[mockListes.length - 1]).toEqual(['a-traiter', '']);
    expect(tuile).toEqual(expect.objectContaining({ detail: '2 à traiter', value: '3' }));
    expect(tuile.color).toBe(tuile.detailColor);
    mockListe = {
      data: { ...LISTE, compteurs: { aTraiter: 0, suspendus: 0, tous: 3 } }, isLoading: false,
    };
    tuile = await lireLaTuile();
    expect(tuile).toEqual(expect.objectContaining({ detail: 'Rien à traiter', value: '3' }));
    mockListe = { data: undefined, error: new Error('403'), isLoading: false };
    tuile = await lireLaTuile();
    expect(tuile.value).toBe('—');
  });
});
