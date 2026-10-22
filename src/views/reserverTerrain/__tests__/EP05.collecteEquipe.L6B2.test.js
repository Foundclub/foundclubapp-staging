import renderer, { act } from 'react-test-renderer';

import ReserverResultat from '@/views/reserverTerrain/ReserverResultat';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P05, ce que le serveur RESA-L3 ouvre (planche EP05 états 1, 3, 4 ;
// plan E-P05 ; A-P05, A-P07, A-P04) :
//   · confirmée : Primary « Inviter par lien » (la feuille du lien), Secondary « Voir ma
//     réservation » ;
//   · collecte lancée : « Collecte lancée : 1/10 », la phrase d'A-P08 annoncée d'avance, la jauge
//     et la date limite, « Inviter par lien », « Il me manque des joueurs » (E-P09), « Voir ma
//     collecte » ;
//   · pour une équipe : « C'est réservé pour U15 Valbrune ! », « au nom de … » et « Les 11 joueurs
//     de U15 Valbrune sont prévenus. » (N-27).

// Un écran entier monté : sous charge (suite complète, PC occupé), le premier cas paie le
// chargement des modules et dépassait les 5 s par défaut (motif de COLL-CONSOLE, 02/10).
jest.setTimeout(30000);

const mockNavigate = jest.fn();
const mockPopToTop = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, popToTop: mockPopToTop }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1', firstname: 'Mathis', lastname: 'Renaud' } }),
}));
const mockLien = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
  // RESA-FIN-SITE : la relecture par identifiant (site rechargé) ; ici la réservation arrive en
  // paramètre.
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

/**
 * Le bouton dont le titre est exactement celui-ci.
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre.
 * @returns {any} Le bouton.
 */
const bouton = (arbre, titre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
))[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLien.mockResolvedValue({
    actif: true, code: 'K7Q2M9', url: 'https://foundclub.app/r/K7Q2M9',
  });
  mockParams = { reservation: maReservation() };
});

it('confirmée : Primary « Inviter par lien », puis Secondary « Voir ma réservation »', async () => {
  const arbre = await monter();
  expect(bouton(arbre, 'Inviter par lien').props.variant).toBe('Primary');
  expect(bouton(arbre, 'Voir ma réservation').props.variant).toBe('Secondary');
  await act(async () => {
    bouton(arbre, 'Inviter par lien').props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockLien).toHaveBeenCalledWith({ actif: true, reservationId: 'r-1' });
  expect(lisibles(arbre)).toContain('Ceux qui ont le lien voient la partie ; pour répondre, il '
    + 'leur faut un compte.');
  expect(lisibles(arbre)).not.toContain('Désactiver le lien');
});

describe('collecte lancée (A-P07, A-P08)', () => {
  beforeEach(() => {
    mockParams = {
      collecte: { collectDeadline: '2026-10-15T16:00:00.000Z', quorum: 10 },
      reservation: maReservation({ status: 'en_collecte' }),
    };
  });

  it('« Collecte lancée : 1/10 », la phrase d’A-P08, la jauge et la date limite', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Collecte lancée : 1/10',
      'Rien n’est réservé tant que 10 joueurs n’ont pas répondu présent. Le créneau reste libre : '
        + 'quelqu’un peut le prendre avant toi.',
      '1 sur 10 · date limite jeudi 15/10, 18 h',
    ]));
    expect(parRepere(arbre, 'resultat-jauge')).not.toBeNull();
    expect(lisibles(arbre)).not.toContain('C’est réservé !');
  });

  it('« Il me manque des joueurs » : l’annonce sur la fiche ; « Voir ma collecte »', async () => {
    const arbre = await monter();
    expect(bouton(arbre, 'Inviter par lien').props.variant).toBe('Primary');
    await act(async () => {
      bouton(arbre, 'Il me manque des joueurs').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      ouvrir: 'annonce', reservationId: 'r-1',
    });
    await act(async () => {
      pressable(arbre, 'Voir ma collecte').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });
});

it('pour une équipe : le titre, « au nom de », et les joueurs prévenus (N-27)', async () => {
  mockParams = {
    equipe: { membres: 11, name: 'U15 Valbrune' },
    reservation: maReservation(),
  };
  expect(lisibles(await monter())).toEqual(expect.arrayContaining([
    'C’est réservé pour U15 Valbrune !',
    'Le Five de Montrivage · au nom de Mathis Renaud',
    'Les 11 joueurs de U15 Valbrune sont prévenus.',
  ]));
});

it('une demande : « Voir ma demande » en Secondary, pas d’« Inviter par lien »', async () => {
  mockParams = {
    reservation: maReservation({ expiresAt: '2026-10-16T14:00:00.000Z', status: 'en_attente' }),
  };
  const arbre = await monter();
  expect(bouton(arbre, 'Voir ma demande').props.variant).toBe('Secondary');
  expect(bouton(arbre, 'Inviter par lien')).toBeUndefined();
});
