import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverMesReservations from '@/views/reserverTerrain/ReserverMesReservations';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-L6B-1 (19/10/2026) — E-P10 « Mes réservations » (plan E-P10 :1618-1655, planche EP10 et
// gabarit A de la planche OR3, toile BLG79NHv2, « planches ok » du 13/10 ; RC-P03, A-G20). Serveur
// RESA-L2A/L2B : `GET /reservations-terrain/mine?periode=a-venir|passees|refusees`.
// L'écran : l'en-tête, TROIS onglets (À venir · Passées · Refusées et annulées), la liste groupée
// par jour (toucher ⇒ E-P07), les états (chargement, erreur, vide par onglet ⇒ « Réserver un
// terrain »), tirer pour rafraîchir ; sur ordinateur, la liste à gauche et la fiche à droite.
// ⛔ Pas dans ce lot : l'onglet « En collecte » et « Ma fidélité » (serveurs L3, L4 ⇒ RESA-L6B-2),
// « 8/10 joueurs », « Pour U15 Valbrune », « Invité par … » (participants, L3).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

/** @type {Record<string, any>} */
let mockLectures = {};
const mockRelire = jest.fn();
const mockPeriodesLues = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  // RESA-L6B-2 : les groupes de l'onglet « En collecte » et « Ma fidélité » (aucun ici).
  useGroupesDeReservations: () => ({ groupes: {} }),
  useMaFidelite: () => ({ data: [] }),
  useMesReservations: (/** @type {string} */ periode) => {
    mockPeriodesLues(periode);
    return mockLectures[periode];
  },
}));

const mockVersLaRecherche = jest.fn();
jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: (...args) => mockVersLaRecherche(...args),
}));

// Sur ordinateur, le volet de droite monte la VRAIE fiche (E-P07) : ici, sa doublure dit laquelle.
jest.mock('@/views/reserverTerrain/ReserverMaReservation', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FausseFiche(/** @type {any} */ { dansUnVolet, reservationId }) {
    return <Texte>{`FICHE ${reservationId} ${dansUnVolet ? 'dans le volet' : 'seule'}`}</Texte>;
  };
});

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ dockClearance: 0 }));
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
 * Une lecture réussie.
 * @param {any[]} liste - Les réservations.
 * @returns {any} La lecture.
 */
const lue = (liste) => ({
  data: liste, error: null, isLoading: false, isRefetching: false, refetch: mockRelire,
});

const A_VENIR = [
  maReservation(),
  maReservation({
    date: '2026-10-18',
    documentId: 'r-2',
    endsAt: '2026-10-18T18:00:00.000Z',
    expiresAt: '2026-10-17T18:00:00.000Z',
    from: '19:00',
    startsAt: '2026-10-18T17:00:00.000Z',
    status: 'en_attente',
    to: '20:00',
  }),
];
const PASSEES = [
  maReservation({
    date: '2026-10-11',
    documentId: 'r-4',
    endsAt: '2026-10-11T18:00:00.000Z',
    noShowAt: '2026-10-11T19:00:00.000Z',
    startsAt: '2026-10-11T17:00:00.000Z',
  }),
  maReservation({
    date: '2026-10-07',
    documentId: 'r-3',
    endsAt: '2026-10-07T17:00:00.000Z',
    startsAt: '2026-10-07T16:00:00.000Z',
  }),
];
const REFUSEES = [
  maReservation({ documentId: 'r-5', status: 'refusee' }),
  maReservation({ documentId: 'r-6', status: 'sans_reponse' }),
  maReservation({ cancelledBy: 'reserveur', documentId: 'r-7', status: 'annulee' }),
];

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMesReservations />);
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
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = {};
  mockOrdinateur = false;
  mockLectures = {
    'a-venir': lue(A_VENIR),
    passees: lue(PASSEES),
    refusees: lue(REFUSEES),
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P10 — l’en-tête et les onglets', () => {
  // RESA-L6B-2 (20/10/2026) : « En collecte » arrive (serveur RESA-L3) ; « Ma fidélité » ne
  // s'affiche qu'avec un programme actif (aucun ici). Témoin : EP10.collecteFidelite.L6B2.test.js.
  it('« MES RÉSERVATIONS » et quatre onglets, sans « Ma fidélité » sans programme', async () => {
    const arbre = await monter();
    const textes = lisibles(arbre);
    expect(textes).toEqual(expect.arrayContaining([
      'MES RÉSERVATIONS', 'À venir', 'En collecte', 'Passées', 'Refusées et annulées',
    ]));
    expect(textes.join(' ')).not.toMatch(/fidélité/i);
    expect(mockPeriodesLues).toHaveBeenLastCalledWith('a-venir');
  });
});

describe('E-P10 — À venir', () => {
  it('groupée par jour : le jour, l’heure, le complexe, le terrain, la pastille', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Vendredi 16 octobre',
      '18 h · Le Five de Montrivage · Terrain 1',
      'Tu as réservé',
      'Confirmée',
      'Dimanche 18 octobre',
      '19 h · Le Five de Montrivage · Terrain 1',
      'Demande envoyée · réponse avant le 17/10 à 20 h',
      'En attente',
    ]));
  });

  it('toucher une réservation ouvre sa fiche (E-P07)', async () => {
    const arbre = await monter();
    await appuyer(arbre, '19 h · Le Five de Montrivage · Terrain 1');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-2',
    });
  });

  it('tirer pour rafraîchir relit l’onglet', async () => {
    const arbre = await monter();
    const defilement = arbre.root.findAll((/** @type {any} */ n) => n.props?.refreshControl)[0];
    await act(async () => {
      defilement.props.refreshControl.props.onRefresh();
    });
    expect(mockRelire).toHaveBeenCalled();
  });
});

describe('E-P10 — Passées, Refusées et annulées', () => {
  it('« Passées » : jouée, non honorée', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Passées');
    expect(mockPeriodesLues).toHaveBeenLastCalledWith('passees');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Dimanche 11 octobre', 'Non honorée', 'Mercredi 7 octobre', 'Jouée',
    ]));
    expect(lisibles(arbre)).not.toContain('Tu as réservé');
  });

  it('« Refusées et annulées » : refusée, sans réponse, annulée par toi', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Refusées et annulées');
    expect(mockPeriodesLues).toHaveBeenLastCalledWith('refusees');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Refusée', 'Sans réponse', 'Annulée par toi',
    ]));
  });
});

describe('E-P10 — les états', () => {
  it('vide, par onglet : la phrase et « Réserver un terrain » (E-P01)', async () => {
    mockLectures = { 'a-venir': lue([]), passees: lue([]), refusees: lue([]) };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucune réservation à venir.');
    await appuyer(arbre, 'Réserver un terrain');
    expect(mockVersLaRecherche).toHaveBeenCalledWith(expect.anything(), 'reservations');
    await appuyer(arbre, 'Passées');
    expect(lisibles(arbre)).toContain('Aucune réservation passée.');
    await appuyer(arbre, 'Refusées et annulées');
    expect(lisibles(arbre)).toContain('Aucune réservation refusée ou annulée.');
  });

  it('chargement : le squelette ; erreur : le dire et « Réessayer »', async () => {
    mockLectures['a-venir'] = {
      data: undefined, error: null, isLoading: true, refetch: mockRelire,
    };
    const enCours = await monter();
    expect(parRepere(enCours, 'reserver-mes-reservations-squelette')).not.toBeNull();

    mockLectures['a-venir'] = {
      data: undefined, error: new Error('Network Error'), isLoading: false, refetch: mockRelire,
    };
    const enPanne = await monter();
    expect(lisibles(enPanne)).toContain('Impossible de charger tes réservations.');
    await appuyer(enPanne, 'Réessayer');
    expect(mockRelire).toHaveBeenCalled();
  });
});

describe('E-P10 — sur ordinateur (OR3, gabarit A) : la liste à gauche, la fiche à droite', () => {
  it('la 1re réservation remplit le volet ; une ligne touchée le remplit, même écran', async () => {
    mockOrdinateur = true;
    const arbre = await monter();
    const fiches = () => arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => String(n.props.children))
      .filter((/** @type {string} */ texte) => texte.startsWith('FICHE'));
    expect(fiches()).toEqual(['FICHE r-1 dans le volet']);
    await appuyer(arbre, '19 h · Le Five de Montrivage · Terrain 1');
    expect(fiches()).toEqual(['FICHE r-2 dans le volet']);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// RESA-FIN-APP-2 (22/10/2026) — E-P10, tournée 2 : « À » au lieu de « À venir », et « Refusées
// et annulées » qui sortait de l'écran. Plan E-P10 §9 : « onglets défilants ». Ce témoin fige ce
// que le plan demande : les quatre onglets dans UNE rangée qui défile, chaque libellé en un seul
// mot (Android 16, `texteInsecable`, corrigé au lot RESA-FIN-APP 527fae41).
describe('RESA-FIN-APP-2 E-P10 — les onglets défilent, aucun libellé coupé', () => {
  it('une rangée horizontale qui défile, les quatre onglets, en un seul mot', async () => {
    const arbre = await monter();
    const rangee = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.horizontal === true && typeof n.type !== 'string'
    ))[0];
    const onglets = ['a-venir', 'en-collecte', 'passees', 'refusees'];
    onglets.forEach((onglet) => {
      expect(parRepere({ root: rangee }, `mes-reservations-onglet-${onglet}`)).not.toBeNull();
    });
    const dessines = rangee.findAllByType(Text)
      .map((/** @type {any} */ n) => String(n.props.children));
    expect(dessines).toEqual([
      'À venir', 'En collecte', 'Passées', 'Refusées et annulées',
    ].map((libelle) => libelle.split(' ').join(String.fromCharCode(160))));
  });
});
