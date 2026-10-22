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
const mockPopToTop = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, popToTop: mockPopToTop }),
  useRoute: () => ({ params: mockParams }),
}));

// RESA-L6B-2 : l'écran lit le compte (« au nom de ») et ouvre la feuille du lien.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  // RESA-FIN-SITE : la relecture par identifiant (site rechargé) ; ici la réservation arrive en paramètre.
  useMaReservation: () => ({ data: null, isLoading: false }),
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

  it('« Voir ma réservation » ouvre sa fiche ; « Retour à l’accueil » remonte', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Voir ma réservation').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
    await act(async () => {
      pressable(arbre, 'Retour à l’accueil').props.onPress();
    });
    expect(mockPopToTop).toHaveBeenCalled();
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
    expect(mockPopToTop).toHaveBeenCalled();
  });
});
