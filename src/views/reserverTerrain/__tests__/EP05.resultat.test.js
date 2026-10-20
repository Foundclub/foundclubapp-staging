import renderer, { act } from 'react-test-renderer';

import ReserverResultat from '@/views/reserverTerrain/ReserverResultat';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P05 « Le résultat » (planches EP05, P00 bloc 4 ; plan E-P05, A-G15,
// AT-08) : le même gabarit (pictogramme sans emoji, titre, phrase, carte résumé, boutons) en deux
// variantes — « C'est réservé ! » (automatique) et « Demande envoyée » (sur demande : le créneau
// est gardé jusqu'à la réponse, AT-08) —, puis « Voir ma réservation » (E-P07) ou « Retour à
// l'accueil ». ⛔ Pas dans ce lot : « Inviter par lien », « Il me manque des joueurs », la collecte,
// la réservation d'équipe et « Tu as rejoint le canal » (serveurs L3 / L4, puis L6b).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
/** @type {Record<string, (evenement: any) => void>} */
const mockEcoutes = {};
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (/** @type {string} */ nom, /** @type {any} */ ecoute) => {
      mockEcoutes[nom] = ecoute;
      return () => { delete mockEcoutes[nom]; };
    },
    navigate: mockNavigate,
    replace: mockReplace,
  }),
  useRoute: () => ({ params: mockParams }),
}));

// RESA-FIN-APP (20/10/2026) — « l'accueil », c'est la racine de l'onglet Accueil (SearchHome), par le
// chemin imbriqué de `allerDansLOnglet` (avec `pop` : la pile de tâche est retirée, l'onglet revient à
// sa racine). `popToTop` ramenait au HomeTab tel qu'on l'avait laissé : sur la RECHERCHE (tournée 2).
const VERS_L_ACCUEIL = [
  RouteNames.HomeTab,
  { params: { params: undefined, pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
  { pop: true },
];

// RESA-L6B-2 : l'écran lit le compte (« au nom de ») et ouvre la feuille du lien.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverResultat />);
  });
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { reservation: maReservation() };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P05 — le résultat', () => {
  it('confirmée : « C’est réservé ! », la carte résumé, la pastille', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'C’est réservé !',
      'Vendredi 16/10 · 18 h – 19 h · Terrain 1',
      'Le Five de Montrivage · 60 €, à régler sur place',
      'Confirmée',
    ]));
    expect(parRepere(arbre, 'pastille-etat-confirmee')).not.toBeNull();
  });

  // RESA-FIN-APP — tournées 1 et 2 : « Retour à l'accueil » ramenait à la RECHERCHE ; et après une
  // annulation faite depuis la fiche, le retour arrière remontrait l'ancien « C'est réservé ! ·
  // Confirmée ». La fiche REMPLACE le résultat : il ne reste rien de périmé derrière elle.
  it('« Voir ma réservation » remplace le résultat par sa fiche ; « Retour à l’accueil » : l’accueil', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Voir ma réservation').props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(RouteNames.ReserverMaReservation, expect.anything());
    await act(async () => {
      pressable(arbre, 'Retour à l’accueil').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(...VERS_L_ACCUEIL);
  });

  // RESA-FIN-APP — tournée 2 : le retour arrière ramenait au choix du créneau (E-P03). Plan E-P05 §4 :
  // « retour ⇒ accueil (pas de retour au récapitulatif) ».
  it('le retour arrière (bouton du téléphone, flèche) mène à l’accueil', async () => {
    await monter();
    expect(typeof mockEcoutes.beforeRemove).toBe('function');
    const preventDefault = jest.fn();
    await act(async () => {
      mockEcoutes.beforeRemove({ data: { action: { type: 'GO_BACK' } }, preventDefault });
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenLastCalledWith(...VERS_L_ACCUEIL);
    // Une sortie voulue par l'écran (vers l'accueil, vers la fiche) n'est pas retenue.
    const laisser = jest.fn();
    mockEcoutes.beforeRemove({ data: { action: { type: 'NAVIGATE' } }, preventDefault: laisser });
    expect(laisser).not.toHaveBeenCalled();
  });

  it('sur demande : « Demande envoyée », l’échéance, le créneau gardé (AT-08)', async () => {
    mockParams = {
      reservation: maReservation({ expiresAt: '2026-10-16T14:00:00.000Z', status: 'en_attente' }),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Demande envoyée',
      'Le Five de Montrivage te répond avant le 16/10 à 16 h. Le créneau t’est gardé jusque-là.',
      'En attente',
      'Voir ma demande',
    ]));
  });

  it('sans réservation (lien périmé) : le dire, et ramener à l’accueil', async () => {
    mockParams = {};
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Cette réservation n’existe plus.');
    await act(async () => {
      pressable(arbre, 'Retour à l’accueil').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(...VERS_L_ACCUEIL);
  });
});
