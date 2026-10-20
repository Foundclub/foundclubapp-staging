import renderer, { act } from 'react-test-renderer';

import ReserverAnnonce from '@/views/reserverTerrain/ReserverAnnonce';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { annonceDeReservation, groupe } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P09 B, la page de l'annonce « Il me manque des joueurs »
// (planche EP09 états 2 à 10 ; plan E-P09 ; A-P09, RC-P09, RC-T02, AT-05 A, RG-HONNEUR) :
// « Il manque 2 joueurs » et sa pastille (Ouverte / Complète / Fermée), la carte de la partie
// (⇒ E-P02), « Déjà là · 8 » (prénom + initiale), « Je viens » et l'engagement ; « Tu es dans la
// partie ! » puis « Voir la partie » ; refus nommés (âge, banni, complète) ; le réserveur :
// « Annonce publiée. », « Partager » (le lien de la réservation), « Fermer l'annonce ». Ouverte
// aussi par N-28 (témoin plus bas).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockLecture = /** @type {any} */ ({});
const mockRejoindre = jest.fn();
const mockFermer = jest.fn();
const mockLien = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnonce: () => mockLecture,
  useFermerUneAnnonce: () => ({ isPending: false, mutateAsync: mockFermer }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
  useRejoindreUneAnnonce: () => ({ isPending: false, mutateAsync: mockRejoindre }),
}));
let mockNaissance = /** @type {string | null} */ ('1995-03-02');
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: mockNaissance, documentId: 'u-2' } }),
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
    arbre = renderer.create(<ReserverAnnonce />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNaissance = '1995-03-02';
  mockParams = { annonceId: 'a-1' };
  mockLecture = { data: annonceDeReservation(), isLoading: false };
  mockRejoindre.mockResolvedValue(groupe({
    counts: { absents: 0, presents: 9, sansReponse: 0 },
    myResponse: 'present',
    reservation: 'r-1',
    role: 'participant',
  }));
});

it('un joueur : « Il manque 2 joueurs », Ouverte, la partie, « Je viens »', async () => {
  const vus = lisibles(await monter());
  expect(vus).toEqual(expect.arrayContaining([
    'IL MANQUE 2 JOUEURS',
    'Ouverte',
    'Vendredi 16 octobre · 18 h – 19 h',
    'Le Five de Montrivage · Terrain 1',
    'Foot à 5 · niveau Loisir · 60 € le créneau, à régler sur place',
    'Déjà là · 8',
    'Julien M., Karim B., Sami A., Théo L., Noah R., Lucas T., Ilyes K., Hugo P.',
    'Je viens',
    'Tu t’engages sur l’honneur à venir si tu réponds présent.',
  ]));
  expect(vus).not.toContain('Fermer l’annonce');
});

it('« Je viens » : « Tu es dans la partie ! », puis « Voir la partie » (E-P07)', async () => {
  const arbre = await monter();
  await toucher(parRepere(arbre, 'annonce-je-viens'));
  expect(mockRejoindre).toHaveBeenCalledWith('a-1');
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Tu es dans la partie !',
    'Le Five de Montrivage · 9 présents sur 10',
  ]));
  await toucher(pressable(arbre, 'Voir la partie'));
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
    reservationId: 'r-1',
  });
});

it('refus nommés : banni (sans raison), complète', async () => {
  mockRejoindre.mockRejectedValueOnce({
    details: { code: 'COMPLEXE_RESERVATION_BANNED' }, status: 403,
  });
  const arbre = await monter();
  await toucher(parRepere(arbre, 'annonce-je-viens'));
  expect(lisibles(arbre)).toContain('Tu ne peux pas rejoindre une partie dans ce complexe.');
  mockRejoindre.mockRejectedValueOnce({
    details: { code: 'COMPLEXE_RESERVATION_COMPLETE' }, status: 409,
  });
  await toucher(parRepere(arbre, 'annonce-je-viens'));
  expect(lisibles(arbre)).toContain('La partie est complète.');
});

it('sous l’âge minimum (RC-T02) : « À partir de 16 ans… », pas de « Je viens »', async () => {
  mockNaissance = '2012-01-01';
  const arbre = await monter();
  expect(lisibles(arbre)).toContain('À partir de 16 ans dans ce complexe.');
  expect(parRepere(arbre, 'annonce-je-viens')).toBeNull();
});

it('complète, fermée : leur titre, leur pastille, plus de « Je viens »', async () => {
  mockLecture = { data: annonceDeReservation({ canJoin: false, joined: 2, status: 'complete' }) };
  let vus = lisibles(await monter());
  expect(vus).toEqual(expect.arrayContaining([
    'PARTIE COMPLÈTE', 'Complète', 'La partie est complète.',
  ]));
  expect(vus).not.toContain('Je viens');
  mockLecture = { data: annonceDeReservation({ canJoin: false, status: 'fermee' }) };
  vus = lisibles(await monter());
  expect(vus).toEqual(expect.arrayContaining([
    'IL MANQUAIT 2 JOUEURS', 'Fermée', 'Cette annonce est fermée.',
  ]));
});

it('le réserveur : « Annonce publiée. », « Partager », « Fermer l’annonce »', async () => {
  mockParams = { annonceId: 'a-1', publiee: true, reservationId: 'r-1' };
  mockLecture = { data: annonceDeReservation({ canJoin: false }) };
  mockFermer.mockResolvedValue({ status: 'fermee' });
  mockLien.mockResolvedValue({
    actif: true, code: 'K7Q2M9', url: 'https://foundclub.app/r/K7Q2M9',
  });
  const arbre = await monter();
  expect(lisibles(arbre)).toEqual(expect.arrayContaining([
    'Annonce publiée.', 'Partager', 'Fermer l’annonce',
  ]));
  expect(parRepere(arbre, 'annonce-je-viens')).toBeNull();
  await toucher(pressable(arbre, 'Partager'));
  expect(mockLien).toHaveBeenCalledWith({ actif: true, reservationId: 'r-1' });
  await toucher(pressable(arbre, 'Fermer l’annonce'));
  expect(mockFermer).toHaveBeenCalledWith('a-1');
});

it('introuvable : « Cette annonce n’existe plus. »', async () => {
  mockLecture = {
    data: null, error: { details: { code: 'COMPLEXE_RESERVATION_NOT_FOUND' }, status: 404 },
  };
  expect(lisibles(await monter())).toContain('Cette annonce n’existe plus.');
});

describe('N-28 — la notification d’une annonce ouvre sa page', () => {
  /**
   * L'aiguillage, l'interrupteur à la valeur voulue.
   * @param {boolean} allume - `COMPLEXES_JOUEUR`.
   * @returns {any} Le module.
   */
  const charger = (allume) => {
    let module;
    jest.isolateModules(() => {
      jest.doMock('@/config/fonctionsMasquees', () => ({
        ...jest.requireActual('@/config/fonctionsMasquees'),
        COMPLEXES_JOUEUR: allume,
      }));
      // eslint-disable-next-line global-require
      module = require('@/utils/notifications/notificationNavigation');
    });
    return module;
  };

  it('allumé : `change: annonce` + `annonceId` ⇒ la page de l’annonce', () => {
    expect(charger(true).resolveNotificationDestination({
      data: { annonceId: 'a-1', change: 'annonce', reservationId: 'r-1' },
      type: 'complexeReservationJoueur',
    })).toEqual({ params: { annonceId: 'a-1' }, route: RouteNames.ReserverAnnonce });
  });

  it('les autres changements de la partie mènent toujours à la réservation', () => {
    expect(charger(true).resolveNotificationDestination({
      data: { change: 'participant-present', reservationId: 'r-1' },
      type: 'complexeReservationJoueur',
    })).toEqual({
      params: { change: 'participant-present', reservationId: 'r-1' },
      route: RouteNames.ReserverMaReservation,
    });
  });
});
