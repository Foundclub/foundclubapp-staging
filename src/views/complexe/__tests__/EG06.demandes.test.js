import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeDemandes from '@/views/complexe/ComplexeDemandes';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — E-G06 « Les demandes » (planche EG06) : onglets En attente · Traitées,
// une carte = une phrase, « Expire dans 5 h », Accepter · Refuser (motif obligatoire pour le
// serveur), le conflit « Ce créneau vient d'être pris. », les deux états vides, le chargement,
// l'erreur. Doublures : le contrat d'API L2A (`GET /complexes/:id/reservations?vue=demandes`).

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockAttente = /** @type {any} */ ({});
let mockTraitees = /** @type {any} */ ({});
let mockTerrains = /** @type {any} */ ({});
const mockDecider = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeChoisi: () => ({
    complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
    complexeId: 'cx-five',
    mes: { isLoading: false },
  }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => (
    filtres.vue === 'demandes' ? mockAttente : mockTraitees
  ),
  useTerrains: () => mockTerrains,
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
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

/**
 * Une demande telle que la liste du gérant la rend (`toManagerListItem`, RESA-L2A).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La ligne.
 */
const demande = (autres = {}) => ({
  date: '2026-10-19',
  documentId: 'r-1',
  endsAt: '2026-10-19T09:00:00.000Z',
  expiresAt: '2026-10-14T13:10:00.000Z',
  from: '10:00',
  label: 'Julien M.',
  players: 10,
  source: 'app',
  startsAt: '2026-10-19T08:00:00.000Z',
  status: 'en_attente',
  terrain: { documentId: 't-2', name: 'Terrain 2' },
  to: '11:00',
  ...autres,
});

/**
 * Une lecture par pages (`useInfiniteQuery`).
 * @param {any[]} items - Les lignes.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const pages = (items, autres = {}) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
  ...autres,
});

/**
 * Appuie sur le premier élément pressable DANS le repère (le `Button` de l'app ne porte pas de
 * repère : on repère son conteneur).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère du conteneur.
 * @returns {Promise<void>} Fini.
 */
const appuyerDans = async (arbre, testID) => {
  const noeud = parRepere(arbre, testID);
  const cible = noeud.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeDemandes />);
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

beforeAll(() => {
  // Mercredi 14 octobre 2026, 10 h à Paris : seule l'horloge est figée.
  jest.useFakeTimers({
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance',
      'hrtime',
    ],
    now: new Date('2026-10-14T08:00:00.000Z'),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDecider.mockResolvedValue({ data: {} });
  mockAttente = pages([
    demande(),
    demande({
      date: '2026-10-18',
      documentId: 'r-2',
      expiresAt: '2026-10-15T09:00:00.000Z',
      from: '18:00',
      label: 'Lina T.',
      to: '19:00',
    }),
  ]);
  mockTraitees = pages([
    demande({
      date: '2026-10-16', documentId: 'r-3', from: '18:00', label: 'Karim B.', status: 'confirmee',
    }),
    demande({
      date: '2026-10-17', documentId: 'r-4', from: '20:00', label: 'Sami A.', status: 'refusee',
    }),
    demande({
      date: '2026-10-13',
      documentId: 'r-5',
      from: '19:00',
      label: 'Noah R.',
      status: 'sans_reponse',
    }),
  ]);
  mockTerrains = {
    data: [
      terrainDeTemoin(),
      terrainDeTemoin({ bookingMode: 'manuel', documentId: 't-2', name: 'Terrain 2' }),
    ],
    isLoading: false,
  };
});

describe('RESA-L5A2 E-G06 — En attente (état 1)', () => {
  it('l’en-tête, les onglets, une phrase par demande et son échéance', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    const ordre = [
      COMPLEXE_FIVE.name.toUpperCase(),
      'DEMANDES',
      'En attente (2)',
      'Traitées',
      'Julien M. demande le Terrain 2 · lundi 19/10 · 10 h – 11 h',
      'Expire dans 5 h',
      'Lina T. demande le Terrain 2 · dimanche 18/10 · 18 h – 19 h',
      'Expire dans 1 jour',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('« Accepter » : la décision part, « Demande acceptée. » (N-14)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'demande-accepter-r-1');
    expect(mockDecider).toHaveBeenCalledWith({
      complexeId: 'cx-five', decision: 'accepter', reservationId: 'r-1',
    });
    expect(lisibles(arbre)).toContain('Demande acceptée. Julien M. est prévenu.');
  });

  it('« Accepter » : le créneau vient d’être pris (409), on ne peut plus que refuser', async () => {
    mockDecider.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_SLOT_TAKEN' }, message: 'pris', status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'demande-accepter-r-1');
    expect(lisibles(arbre)).toContain('Ce créneau vient d’être pris.');
    expect(parRepere(arbre, 'demande-accepter-r-1')).toBeNull();
    expect(lisibles(arbre)).toContain('Refuser avec un mot');
    // (Le bouton est DANS la carte, qui ouvre la fiche : on appuie sur le bouton lui-même.)
    await appuyerDans(arbre, 'demande-refuser-r-1');
    expect(parRepere(arbre, 'feuille-motif')).not.toBeNull();
  });

  it('« Refuser » : un motif en un appui, puis la décision avec ce motif (N-15)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'demande-refuser-r-2');
    expect(lisibles(arbre)).toContain('Refuser la demande de Lina T.');
    // Sans motif, le bouton rouge reste éteint : le serveur l'exige.
    const boutons = () => parRepere(arbre, 'feuille-motif').findAll((/** @type {any} */ noeud) => (
      noeud.props?.title === 'Refuser' && typeof noeud.props?.onPress === 'function'
    ));
    expect(boutons()[0].props.disabled).toBe(true);
    await appuyer(arbre, 'Terrain indisponible');
    expect(boutons()[0].props.disabled).toBe(false);
    await act(async () => {
      boutons()[0].props.onPress();
    });
    expect(mockDecider).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      decision: 'refuser',
      reason: 'Terrain indisponible',
      reservationId: 'r-2',
    });
  });

  it('toucher une carte ouvre la fiche (E-G05)', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'demande-r-1').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-1',
    });
  });
});

// RESA-L7-1 (20/10/2026) — vu sur le site (capture du banc, 390 et 1 360 px), vrai au téléphone :
// les noms en gras d'une ligne (« Julien M. », « Terrain 2 ») prenaient le NOIR de `Fonts.p2Bold`
// (theme/fonts.js) sur la carte sombre — illisibles. Ils reprennent le blanc de la phrase.
describe('RESA-L7-1 E-G06 — les noms en gras restent lisibles sur la carte sombre', () => {
  const couleursDe = (/** @type {any} */ arbre, /** @type {string} */ texte) => arbre.root
    .findAll((/** @type {any} */ n) => n.type === 'Text' && n.props.children === texte)
    .map((/** @type {any} */ n) => StyleSheet.flatten(n.props.style)?.color);

  it('En attente : le nom et le terrain', async () => {
    const arbre = await monter();
    const couleurs = [...couleursDe(arbre, 'Julien M.'), ...couleursDe(arbre, 'Terrain 2')];
    expect(couleurs.length).toBeGreaterThan(0);
    couleurs.forEach((couleur) => expect(couleur).not.toBe('black'));
  });

  it('Traitées : le nom', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Traitées');
    const couleurs = couleursDe(arbre, 'Karim B.');
    expect(couleurs.length).toBeGreaterThan(0);
    couleurs.forEach((couleur) => expect(couleur).not.toBe('black'));
  });
});

describe('RESA-L5A2 E-G06 — Traitées (état 2)', () => {
  it('la décision de chaque demande : acceptée, refusée, sans réponse', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Traitées');
    const lus = lisibles(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Karim B. · Terrain 2 · vendredi 16/10 · 18 h',
      'Acceptée',
      'Sami A. · Terrain 2 · samedi 17/10 · 20 h',
      'Refusée',
      'Noah R. · Terrain 2 · mardi 13/10 · 19 h',
      'Sans réponse',
    ]));
  });
});

describe('RESA-L5B-1 B1 E-G06 — Traitées : la date et le motif (serveur RESA-L2C)', () => {
  it('« Acceptée le 14/10 », « Refusée : terrain indisponible », « Sans réponse »', async () => {
    mockTraitees = pages([
      demande({
        decidedAt: '2026-10-14T08:00:00.000Z',
        documentId: 'r-5',
        label: 'Karim B.',
        reason: null,
        status: 'confirmee',
      }),
      demande({
        decidedAt: '2026-10-14T09:00:00.000Z',
        documentId: 'r-6',
        label: 'Sami A.',
        reason: 'terrain indisponible',
        status: 'refusee',
      }),
      demande({
        decidedAt: null, documentId: 'r-7', label: 'Noah R.', reason: null, status: 'sans_reponse',
      }),
    ]);
    const arbre = await monter();
    await appuyer(arbre, 'Traitées');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Acceptée le 14/10', 'Refusée : terrain indisponible', 'Sans réponse',
    ]));
  });

  it('le nom en gras reste blanc sur le fond sombre (le gras de l’app est noir)', async () => {
    const { StyleSheet, Text } = jest.requireActual('react-native');
    const blanc = jest.requireActual('@/theme/colors').default().neutral00;
    const couleurDe = (/** @type {any} */ arbre, /** @type {string} */ texte) => StyleSheet.flatten(
      arbre.root.findAllByType(Text).find((/** @type {any} */ n) => n.props.children === texte)
        ?.props.style,
    )?.color;
    let arbre = await monter();
    expect(couleurDe(arbre, 'Julien M.')).toBe(blanc);
    expect(couleurDe(arbre, 'Terrain 2')).toBe(blanc);
    mockTraitees = pages([demande({ documentId: 'r-5', label: 'Karim B.', status: 'confirmee' })]);
    arbre = await monter();
    await appuyer(arbre, 'Traitées');
    expect(couleurDe(arbre, 'Karim B.')).toBe(blanc);
  });
});

describe('RESA-L5A2 E-G06 — les états vides, le chargement, l’erreur', () => {
  it('aucune demande, un terrain en validation manuelle (état 3)', async () => {
    mockAttente = pages([]);
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'En attente (0)',
      'Aucune demande en attente.',
      'Tes terrains en validation manuelle apparaîtront ici.',
    ]));
  });

  it('aucun terrain manuel : « Changer » ouvre Mes installations (état 4)', async () => {
    mockAttente = pages([]);
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Tous tes terrains se réservent en automatique.');
    await appuyer(arbre, 'Changer');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeInstallations, {
      complexeId: 'cx-five',
    });
  });

  it('chargement : le squelette ; erreur : « Réessayer » relit (état 6)', async () => {
    mockAttente = pages([], { data: undefined, isLoading: true });
    let arbre = await monter();
    expect(parRepere(arbre, 'demandes-squelette')).not.toBeNull();
    const refetch = jest.fn();
    mockAttente = pages([], { data: undefined, error: new Error('boum'), refetch });
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Les demandes n’ont pas pu être lues.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('plus de 20 demandes : « Voir plus » lit la page suivante', async () => {
    const fetchNextPage = jest.fn();
    mockAttente = pages([demande()], { fetchNextPage, hasNextPage: true });
    const arbre = await monter();
    await appuyer(arbre, 'Voir plus');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2 : une demande EXPIRÉE (« Cette demande a expiré. », 409 d'état) proposait
// « Refuser avec un mot », qui échouait à son tour (409) : la demande restait coincée, aucun geste ne passait. Le
// refus du serveur se dit sur la carte, la liste se relit, et aucun geste voué à l'échec n'est proposé. Le cas
// « créneau pris » (témoin juste au-dessus) garde « Refuser avec un mot ».
describe('RESA-FIN-APP (5) E-G06 — une demande expirée ne propose plus de geste voué à l’échec', () => {
  it('« Cette demande a expiré. » : le message, la liste relue, ni « Accepter » ni « Refuser »', async () => {
    mockDecider.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_STATE' }, message: 'Cette demande a expiré.', status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'demande-accepter-r-1');
    expect(lisibles(arbre)).toContain('Cette demande a expiré.');
    expect(mockAttente.refetch).toHaveBeenCalled();
    expect(parRepere(arbre, 'demande-accepter-r-1')).toBeNull();
    expect(parRepere(arbre, 'demande-refuser-r-1')).toBeNull();
  });
});
