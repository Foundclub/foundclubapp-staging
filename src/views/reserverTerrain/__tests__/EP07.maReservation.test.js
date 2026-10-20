import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { complexePublic, maReservation } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P07 « La fiche de ma réservation » (planches EP07, OR3 ; plan E-P07,
// RC-P07, AT-08) : l'en-tête et la pastille d'état ; « Quand, où » (jour, heures, complexe et
// terrain, prix indicatif, Itinéraire, Ajouter à l'agenda) ; annuler DANS le délai figé (une
// demande se retire toujours) ; après le délai : « appelle le complexe » et son numéro ; refusée,
// sans réponse, annulée, fermeture : l'en-tête d'échec (E-P13) et plus d'actions ; jouée :
// « Réserver à nouveau » ; l'historique.
// ⛔ Pas dans ce lot : participants et présences, Inviter par lien, Il me manque des joueurs,
// Discussion du groupe, Écrire au complexe, fidélité, collecte (serveurs L3 / L4, puis L6b).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockPopToTop = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, popToTop: mockPopToTop, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

let mockLecture = /** @type {any} */ ({});
const mockAnnuler = jest.fn();
const mockRelire = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  // RESA-L6B-2 : le groupe, la relation au complexe, les fils, le lien et l'annonce (aucun ici).
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: () => mockLecture,
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

const mockCarte = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ cible) => mockCarte(cible),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMaReservation />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé, et laisse passer la réponse.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * La lecture d'une réservation.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const lue = (autres = {}) => ({
  data: maReservation(autres), error: null, isLoading: false, refetch: mockRelire,
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockParams = { reservationId: 'r-1' };
  mockLecture = lue();
  mockAnnuler.mockResolvedValue(maReservation({ cancelledBy: 'reserveur', status: 'annulee' }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P07 — une réservation confirmée, avant le délai', () => {
  it('l’en-tête, la pastille, « Quand, où », le prix', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'MA RÉSERVATION',
      'Confirmée',
      'Vendredi 16 octobre · 18 h – 19 h',
      'Le Five de Montrivage · Terrain 1',
      '60 €, à régler sur place',
    ]));
  });

  it('« Itinéraire » : l’adresse du complexe ; « Ajouter à l’agenda » : Google', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Itinéraire');
    expect(mockCarte).toHaveBeenCalledWith({
      label: complexePublic().address.label, latitude: 48.8365, longitude: 1.484,
    });
    await appuyer(arbre, 'Ajouter à l’agenda');
    const lien = /** @type {any} */ (Linking.openURL).mock.calls[0][0];
    expect(lien).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(lien).toContain('dates=20261016T160000Z/20261016T170000Z');
  });

  it('le complexe ouvre sa page (E-P02)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Le Five de Montrivage · Terrain 1');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
      slug: 'le-five-de-montrivage',
    });
  });

  it('annuler : « gratuit jusqu’au … », la confirmation, puis « annulée par toi »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Gratuit jusqu’au 15/10 à 18 h.');
    await appuyer(arbre, 'Annuler la réservation');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Annuler ta réservation du 16/10 à 18 h ?',
      'Le complexe sera prévenu. C’est gratuit jusqu’au 15/10 à 18 h.',
    ]));
    await appuyer(arbre, 'Oui, annuler');
    expect(mockAnnuler).toHaveBeenCalledWith('r-1');
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverEchec, expect.objectContaining({
      complexe: 'Le Five de Montrivage',
      date: '2026-10-16',
      from: '18:00',
      slug: 'le-five-de-montrivage',
      terrain: 'Terrain 1',
      terrainId: 't-1',
      to: '19:00',
      variante: 'annuleeParToi',
    }));
  });

  it('« Garder » referme la confirmation sans rien envoyer', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Annuler la réservation');
    await appuyer(arbre, 'Garder');
    expect(mockAnnuler).not.toHaveBeenCalled();
    expect(lisibles(arbre)).not.toContain('Annuler ta réservation du 16/10 à 18 h ?');
  });

  it('refusé « trop tard » au dernier moment : appelle le complexe', async () => {
    mockAnnuler.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_CANCEL_TOO_LATE', phone: '+33639981234' }, status: 409,
    });
    const arbre = await monter();
    await appuyer(arbre, 'Annuler la réservation');
    await appuyer(arbre, 'Oui, annuler');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Le délai est passé : appelle le complexe.', 'Appeler le 06 39 98 12 34',
    ]));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('l’historique : la date de la réservation, le petit mot', async () => {
    expect(lisibles(await monter())).toEqual(expect.arrayContaining([
      'Historique', 'Réservée le 12/10 à 21 h 04', 'Ton petit mot : « Foot du jeudi »',
    ]));
  });
});

describe('E-P07 — les autres états', () => {
  it('après le délai (RC-P07) : plus d’annulation dans l’app, « Appeler »', async () => {
    mockLecture = lue({ canCancel: false, cancellableUntil: '2026-10-13T16:00:00.000Z' });
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Le délai est passé : appelle le complexe.');
    expect(vus).not.toContain('Annuler la réservation');
    await appuyer(arbre, 'Appeler le 06 39 98 12 34');
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+33639981234');
  });

  it('en attente : l’échéance, le créneau gardé, « Annuler la demande »', async () => {
    mockLecture = lue({ expiresAt: '2026-10-16T14:00:00.000Z', status: 'en_attente' });
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'En attente',
      'Le Five de Montrivage te répond avant le 16/10 à 16 h. Le créneau t’est gardé jusque-là.',
    ]));
    await appuyer(arbre, 'Annuler la demande');
    expect(lisibles(arbre)).toContain('Retirer ta demande du 16/10 à 18 h ?');
    await appuyer(arbre, 'Oui, retirer');
    expect(mockAnnuler).toHaveBeenCalledWith('r-1');
  });

  it('refusée : l’en-tête d’échec, le motif, « Voir d’autres créneaux », c’est tout', async () => {
    mockLecture = lue({
      canCancel: false, reason: 'terrain réservé pour un tournoi.', status: 'refusee',
    });
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Refusée',
      'Le Five de Montrivage a refusé ta demande',
      'Motif : terrain réservé pour un tournoi.',
    ]));
    expect(vus).not.toContain('Annuler la réservation');
    await appuyer(arbre, 'Voir d’autres créneaux');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, {
      slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
  });

  it('une fermeture (ouverte par la notification) : le texte de la fermeture', async () => {
    mockParams = { change: 'fermeture', fermeture: 'le 25/10 (travaux)', reservationId: 'r-1' };
    mockLecture = lue({ canCancel: false, cancelledBy: 'complexe', status: 'annulee' });
    expect(lisibles(await monter())).toEqual(expect.arrayContaining([
      'Le complexe sera fermé', 'Fermé le 25/10 (travaux) : ta réservation est annulée.',
    ]));
  });

  it('jouée : « Réserver à nouveau » ; plus d’annulation', async () => {
    mockLecture = lue({
      canCancel: false, endsAt: '2026-10-13T17:00:00.000Z', startsAt: '2026-10-13T16:00:00.000Z',
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Jouée');
    expect(lisibles(arbre)).not.toContain('Annuler la réservation');
    await appuyer(arbre, 'Réserver à nouveau');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, {
      slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
  });

  it('introuvable : « n’existe plus », et l’accueil', async () => {
    mockLecture = {
      data: undefined,
      error: { details: { code: 'COMPLEXE_RESERVATION_NOT_FOUND' }, status: 404 },
      isLoading: false,
      refetch: mockRelire,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Cette réservation n’existe plus.');
    await appuyer(arbre, 'Retour à l’accueil');
    expect(mockPopToTop).toHaveBeenCalled();
  });

  it('chargement, puis erreur avec « Réessayer »', async () => {
    mockLecture = {
      data: undefined, error: null, isLoading: true, refetch: mockRelire,
    };
    expect(parRepere(await monter(), 'reserver-ma-reservation-squelette')).not.toBeNull();
    mockLecture = {
      data: undefined, error: { status: 500 }, isLoading: false, refetch: mockRelire,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger ta réservation.');
    await appuyer(arbre, 'Réessayer');
    expect(mockRelire).toHaveBeenCalled();
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2 : après avoir RETIRÉ une demande (« Annuler la demande » ⇒ « Oui,
// retirer »), l'écran disait « Ta réservation est annulée » — il n'y avait pas de réservation, seulement une
// demande. L'écran d'après le dit : « Ta demande est retirée ».
describe('RESA-FIN-APP (2) E-P07 — retirer une demande n’annonce pas une réservation annulée', () => {
  it('en attente ⇒ « Oui, retirer » ⇒ la variante « demande retirée »', async () => {
    mockLecture = lue({ expiresAt: '2026-10-16T14:00:00.000Z', status: 'en_attente' });
    const arbre = await monter();
    await appuyer(arbre, 'Annuler la demande');
    await appuyer(arbre, 'Oui, retirer');
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverEchec, expect.objectContaining({
      variante: 'demandeRetiree',
    }));
  });
});
