import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverVeille from '@/views/reserverTerrain/ReserverVeille';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-L6B-1 (19/10/2026) — E-P14 « Demain, tu joues ? » (plan E-P14 :1765-1803, planche EP14 de
// la toile BLG79NHv2, « planches ok » du 13/10 ; RC-G08, RC-P07, AT-07, RG-VEILLE). Serveur
// RESA-L2B : `POST /reservations-terrain/:id/veille { data: { reponse: 'confirme' | 'annule' } }`,
// la vue joueur porte `canAnswerDayBefore`, `dayBeforeConfirmedAt`, `cancellableUntil`.
// L'écran : le titre, la carte de la réservation, « Je confirme » / « J'annule », l'aide, la
// mention « hors délai » (AT-07), et les états : déjà confirmée, déjà annulée, annulée par le
// complexe entre-temps, créneau commencé, erreur.
// ⛔ Pas dans ce lot : « 9/10 joueurs présents » et « tes 9 participants sont prévenus » (les
// participants arrivent avec le serveur L3, puis l'app RESA-L6B-2).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

let mockLecture = /** @type {any} */ ({});
const mockRepondre = jest.fn();
const mockRelire = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useMaReservation: () => mockLecture,
  useRepondreALaVeille: () => ({ isPending: false, mutateAsync: mockRepondre }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
// La barre flottante du site : son crochet charge la pile native, que jest ne lit pas.
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ dockClearance: 0 }));
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
 * La réservation de demain vendredi 16/10, 18 h – 19 h, la question de la veille posée à 18 h ;
 * annulable gratuitement jusqu'à vendredi 16 h (délai de 2 h).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La réservation vue par son réserveur.
 */
const deLaVeille = (autres = {}) => maReservation({
  canAnswerDayBefore: true,
  cancellableUntil: '2026-10-16T14:00:00.000Z',
  dayBeforeAskedAt: '2026-10-15T16:00:00.000Z',
  dayBeforeConfirmedAt: null,
  ...autres,
});

/**
 * La lecture d'une réservation.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const lue = (autres = {}) => ({
  data: deLaVeille(autres), error: null, isLoading: false, refetch: mockRelire,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverVeille />);
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
 * Un libellé est-il pressable ?
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {boolean} Vrai s'il existe.
 */
const existe = (arbre, libelle) => {
  try {
    pressable(arbre, libelle);
    return true;
  } catch {
    return false;
  }
};

beforeEach(() => {
  // Jeudi 15/10, 18 h 30 à Paris : la question est partie à 18 h.
  jest.useFakeTimers({ now: new Date('2026-10-15T16:30:00Z') });
  jest.clearAllMocks();
  mockParams = { reservationId: 'r-1' };
  mockLecture = lue();
  mockRepondre.mockImplementation(async (/** @type {any} */ { reponse }) => deLaVeille(
    reponse === 'confirme'
      ? { dayBeforeConfirmedAt: '2026-10-15T16:31:00.000Z' }
      : { canAnswerDayBefore: false, cancelledBy: 'reserveur', status: 'annulee' },
  ));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P14 — la question de la veille', () => {
  it('le titre, la carte, les deux réponses, l’aide, « Voir ma réservation »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Demain, tu joues ?',
      'Vendredi 16/10 · 18 h – 19 h',
      'Le Five de Montrivage · Terrain 1',
      'Si tu annules, le créneau est libéré tout de suite.',
    ]));
    expect(existe(arbre, 'Je confirme')).toBe(true);
    expect(existe(arbre, 'J’annule')).toBe(true);
    expect(existe(arbre, 'Voir ma réservation')).toBe(true);
    // Dans le délai : pas de mention d'annulation tardive.
    expect(lisibles(arbre).join(' ')).not.toContain('Le délai d’annulation est passé');
  });

  it('« Voir ma réservation » ouvre la fiche (E-P07)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Voir ma réservation');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });

  it('« Je confirme » : la réponse part, « Merci, c’est confirmé. », puis la fiche', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Je confirme');
    expect(mockRepondre).toHaveBeenCalledWith({ reponse: 'confirme', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Merci, c’est confirmé.');
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });

  it('« J’annule » demande confirmation ; « Garder » ne fait rien partir', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'J’annule');
    expect(lisibles(arbre)).toContain('Annuler ta réservation de demain 18 h ?');
    await appuyer(arbre, 'Garder');
    expect(mockRepondre).not.toHaveBeenCalled();
    expect(lisibles(arbre)).not.toContain('Annuler ta réservation de demain 18 h ?');
  });

  it('« Oui, annuler » : la réponse part, « C’est annulé. », puis la fiche', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'J’annule');
    await appuyer(arbre, 'Oui, annuler');
    expect(mockRepondre).toHaveBeenCalledWith({ reponse: 'annule', reservationId: 'r-1' });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'C’est annulé.',
      'Le créneau est libéré.',
    ]));
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });

  it('AT-07 : après le délai, la mention « annulation tardive » ; « J’annule » reste', async () => {
    mockLecture = lue({ cancellableUntil: '2026-10-15T16:00:00.000Z' });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      'Le délai d’annulation est passé : le complexe sera prévenu d’une annulation tardive.',
    );
    expect(existe(arbre, 'J’annule')).toBe(true);
  });
});

describe('E-P14 — les états', () => {
  it('déjà confirmée : « Tu as confirmé à 18 h 12. », plus de « Je confirme »', async () => {
    mockLecture = lue({ dayBeforeConfirmedAt: '2026-10-15T16:12:00.000Z' });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Tu as confirmé à 18 h 12.');
    expect(existe(arbre, 'Je confirme')).toBe(false);
    expect(existe(arbre, 'Voir ma réservation')).toBe(true);
  });

  it('déjà annulée par toi', async () => {
    mockLecture = lue({ canAnswerDayBefore: false, cancelledBy: 'reserveur', status: 'annulee' });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Tu as déjà annulé cette réservation.');
    expect(existe(arbre, 'Je confirme')).toBe(false);
  });

  it('annulée par le complexe entre-temps : le message, plus de bouton', async () => {
    mockLecture = lue({ canAnswerDayBefore: false, cancelledBy: 'complexe', status: 'annulee' });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Cette réservation a été annulée par le complexe.');
    expect(existe(arbre, 'Je confirme')).toBe(false);
    expect(existe(arbre, 'J’annule')).toBe(false);
  });

  it('le créneau a commencé : « Trop tard pour confirmer. »', async () => {
    jest.setSystemTime(new Date('2026-10-16T16:10:00Z'));
    mockLecture = lue({ canAnswerDayBefore: false });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Trop tard pour confirmer.');
    expect(existe(arbre, 'Je confirme')).toBe(false);
  });

  it('la réponse n’est pas partie : le dire, relire, « Réessayer » renvoie la même', async () => {
    mockRepondre.mockRejectedValueOnce(new Error('Network Error'));
    const arbre = await monter();
    await appuyer(arbre, 'Je confirme');
    expect(lisibles(arbre)).toContain('La réponse n’est pas partie.');
    expect(mockRelire).toHaveBeenCalled();
    await appuyer(arbre, 'Réessayer');
    expect(mockRepondre).toHaveBeenLastCalledWith({ reponse: 'confirme', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Merci, c’est confirmé.');
  });

  it('rien à demander (aucune question posée) : la fiche à la place', async () => {
    mockLecture = lue({ canAnswerDayBefore: false, dayBeforeAskedAt: null });
    await monter();
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });

  it('chargement : le squelette ; erreur : le dire et « Réessayer »', async () => {
    mockLecture = {
      data: null, error: null, isLoading: true, refetch: mockRelire,
    };
    const enCours = await monter();
    expect(parRepere(enCours, 'reserver-veille-squelette')).not.toBeNull();

    mockLecture = {
      data: null, error: new Error('Network Error'), isLoading: false, refetch: mockRelire,
    };
    const enPanne = await monter();
    expect(lisibles(enPanne)).toContain('Impossible de charger ta réservation.');
    await appuyer(enPanne, 'Réessayer');
    expect(mockRelire).toHaveBeenCalled();
  });
});

// RESA-FIN-APP (22/10) — tournée des notifications (Android 16) : le titre de la
// feuille se coupait en « … demain 17 / h ? ». L'heure y est dessinée en un seul mot (espaces insécables, `texteInsecable`).
describe('RESA-FIN-APP — « demain 18 h » ne se coupe plus', () => {
  it('l’heure du titre de la feuille, sans espace ordinaire', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'J’annule');
    const [titre] = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))
      .filter((texte) => texte.startsWith('Annuler ta réservation de demain'));
    expect(titre).toBe(`Annuler ta réservation de demain 18${String.fromCharCode(160)}h ?`);
  });
});
