import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexePlanning from '@/views/complexe/ComplexePlanning';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — E-G03 « Le planning » (planche EG03) : vues Jour · Semaine · Liste,
// sélecteur de terrain, barre de date, la grille (chaque créneau dit son état et sa source),
// la feuille « Ce créneau » (Réservé à l'extérieur, Bloquer), l'appui long « Bloquer à partir
// d'ici », « Débloquer », le créneau pris pendant la saisie, les états vides. Doublure :
// `GET /complexes/:id/planning?from&to&terrain` (RESA-L2A, `gestion.ts` `planning`).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockPlanning = /** @type {any} */ ({});
/** @type {any[]} */
const mockPeriodes = [];
let mockTerrains = /** @type {any} */ ({});
const mockNoter = jest.fn();
const mockBloquer = jest.fn();
const mockRouvrir = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useBloquerCreneau: () => ({ isPending: false, mutateAsync: mockBloquer }),
  useComplexeChoisi: () => ({
    complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
    complexeId: 'cx-five',
    mes: { isLoading: false },
  }),
  useNoterExterieur: () => ({ isPending: false, mutateAsync: mockNoter }),
  usePlanning: (/** @type {any} */ _id, /** @type {any} */ periode) => {
    mockPeriodes.push(periode);
    return mockPlanning;
  },
  useRouvrirFermetures: () => ({ isPending: false, mutateAsync: mockRouvrir }),
  useTerrains: () => mockTerrains,
}));

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));

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
 * Un créneau du planning (heure de Paris, été : UTC+2).
 * @param {string} date - Le jour.
 * @param {string} de - « HH:MM ».
 * @param {string} a - « HH:MM ».
 * @param {Record<string, any>} [autres] - L'état, la réservation, la fermeture.
 * @returns {Record<string, any>} Le créneau.
 */
const creneau = (date, de, a, autres = {}) => {
  const utc = (/** @type {string} */ heure) => {
    const [h, m] = heure.split(':').map(Number);
    return `${date}T${String(h - 2).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
  };
  return {
    closure: null,
    endsAt: utc(a),
    from: de,
    reservation: null,
    startsAt: utc(de),
    state: 'libre',
    to: a,
    ...autres,
  };
};

const reservation = (
  /** @type {string} */ id,
  /** @type {string} */ label,
  source = 'app',
  status = 'confirmee',
) => ({
  documentId: id, label, source, status,
});

const JOUR = '2026-10-16';

/** Le planning du vendredi 16 octobre : trois terrains (planche EG03, état 1). */
const PLANNING_DU_JOUR = {
  from: JOUR,
  terrains: [
    {
      bookingMode: 'automatique',
      days: [{
        date: JOUR,
        slots: [
          creneau(JOUR, '18:00', '19:00', {
            reservation: reservation('r-1', 'Julien M.'), state: 'reserve-app',
          }),
          creneau(JOUR, '19:00', '20:00', {
            reservation: reservation('r-2', 'M. Dupont', 'exterieur'), state: 'reserve-exterieur',
          }),
          creneau(JOUR, '20:00', '21:00'),
          creneau(JOUR, '21:00', '22:00', {
            reservation: reservation('r-3', 'Lina T.', 'app', 'en_attente'), state: 'en-attente',
          }),
        ],
      }],
      documentId: 't-1',
      isBookable: true,
      name: 'Terrain 1',
    },
    {
      bookingMode: 'manuel',
      days: [{
        date: JOUR,
        slots: [
          creneau(JOUR, '18:00', '19:00', {
            closure: {
              documentId: 'f-1', kind: 'block', label: 'entretien', reason: null,
            },
            state: 'bloque',
          }),
          creneau(JOUR, '19:00', '20:00'),
        ],
      }],
      documentId: 't-2',
      isBookable: true,
      name: 'Terrain 2',
    },
    {
      bookingMode: 'automatique',
      days: [{
        date: JOUR,
        slots: [creneau(JOUR, '18:00', '19:00', {
          closure: {
            documentId: 'f-2', kind: 'closure', label: null, reason: 'travaux',
          },
          state: 'ferme',
        })],
      }],
      documentId: 't-3',
      isBookable: true,
      name: 'Padel A',
    },
  ],
  to: JOUR,
};

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexePlanning />);
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

/**
 * Appuie sur le premier élément pressable DANS le repère (ou sur le repère lui-même).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @param {'onLongPress' | 'onPress'} [geste] - Le geste.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (arbre, testID, geste = 'onPress') => {
  const noeud = parRepere(arbre, testID);
  const cible = typeof noeud.props?.[geste] === 'function'
    ? noeud
    : noeud.findAll((/** @type {any} */ n) => typeof n.props?.[geste] === 'function')[0];
  await act(async () => {
    cible.props[geste]();
  });
};

/**
 * Écrit dans le champ de ce libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé du champ.
 * @param {string} texte - Le texte.
 * @returns {Promise<void>} Fini.
 */
const ecrire = async (arbre, libelle, texte) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityLabel === libelle && typeof n.props?.onChangeText === 'function'
  ))[0];
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

beforeAll(() => {
  // Mercredi 14 octobre 2026, 10 h à Paris.
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
  mockPeriodes.length = 0;
  mockOrdinateur = false;
  mockParams = { complexeId: 'cx-five', date: JOUR };
  mockPlanning = { data: PLANNING_DU_JOUR, isLoading: false, refetch: jest.fn() };
  mockTerrains = {
    data: [
      terrainDeTemoin(),
      terrainDeTemoin({ bookingMode: 'manuel', documentId: 't-2', name: 'Terrain 2' }),
      terrainDeTemoin({ documentId: 't-3', name: 'Padel A' }),
    ],
    isLoading: false,
  };
  mockNoter.mockResolvedValue({ data: {} });
  mockBloquer.mockResolvedValue({ data: {} });
  mockRouvrir.mockResolvedValue({ echecs: [], faits: 1 });
});

describe('RESA-L5A2 E-G03 — vue Jour, tous les terrains (état 1)', () => {
  it('l’en-tête, la date, une colonne par terrain, chaque créneau dit son état', async () => {
    const arbre = await monter();
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({ from: JOUR, to: JOUR });
    const lus = lisibles(arbre);
    const ordre = [
      COMPLEXE_FIVE.name.toUpperCase(),
      'PLANNING',
      'Tous les terrains',
      'Jour',
      'Semaine',
      'Liste',
      'Vendredi 16 octobre',
      'Aujourd’hui',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    // Les colonnes de la grille, une par terrain, dans l'ordre du serveur.
    const enTetes = parRepere(arbre, 'grille-planning').findAllByType(Text)
      .map((/** @type {any} */ n) => n.props.children)
      .filter((/** @type {any} */ texte) => ['Padel A', 'Terrain 1', 'Terrain 2'].includes(texte));
    expect(enTetes).toEqual(['Terrain 1', 'Terrain 2', 'Padel A']);
    expect(lus).toEqual(expect.arrayContaining([
      'Julien M. · App',
      'M. Dupont · Extérieur',
      'Lina T. · En attente',
      'Bloqué : entretien',
      'Fermé : travaux',
    ]));
  });

  it('« › » et « Aujourd’hui » changent de jour', async () => {
    const arbre = await monter();
    await toucher(arbre, 'planning-suivant');
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({ from: '2026-10-17', to: '2026-10-17' });
    await appuyer(arbre, 'Aujourd’hui');
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({ from: '2026-10-14', to: '2026-10-14' });
  });

  it('une réservation (app ou extérieure) ouvre sa fiche (E-G05)', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-1-2026-10-16-19:00');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-2',
    });
  });
});

describe('RESA-L5A2 E-G03 — la feuille « Ce créneau » (états 3 et 8)', () => {
  it('« Réservé à l’extérieur » : le nom libre, puis « Créneau noté : … »', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-1-2026-10-16-20:00');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ce créneau', 'Terrain 1 · vendredi 16/10 · 20 h – 21 h',
    ]));
    await ecrire(arbre, 'Au nom de', 'M. Martin, téléphone');
    await toucher(arbre, 'creneau-enregistrer');
    expect(mockNoter).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      note: {
        date: JOUR, externalName: 'M. Martin, téléphone', from: '20:00', terrain: 't-1',
      },
    });
    expect(lisibles(arbre)).toContain('Créneau noté : M. Martin, téléphone');
  });

  it('créneau pris pendant la saisie (409) : la feuille le dit, le planning se relit', async () => {
    mockNoter.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_SLOT_TAKEN' }, message: 'pris', status: 409,
    });
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-1-2026-10-16-20:00');
    await ecrire(arbre, 'Au nom de', 'M. Martin');
    await toucher(arbre, 'creneau-enregistrer');
    expect(lisibles(arbre)).toContain('Ce créneau vient d’être réservé dans l’app.');
    expect(mockPlanning.refetch).toHaveBeenCalled();
  });

  it('« Bloquer ce créneau » : motif facultatif, une plage d’un jour', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-1-2026-10-16-20:00');
    await toucher(arbre, 'creneau-bloquer');
    expect(mockBloquer).toHaveBeenCalledWith({
      blocage: {
        date: JOUR, from: '20:00', motif: '', to: '21:00',
      },
      terrainId: 't-1',
    });
    expect(lisibles(arbre)).toContain('Créneau bloqué.');
  });
});

describe('RESA-L5A2 E-G03 — bloquer une plage, débloquer (états 4, 9 ter)', () => {
  it('appui long : « Bloquer à partir d’ici », la fin, un créneau réservé gardé', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-1-2026-10-16-20:00', 'onLongPress');
    expect(lisibles(arbre)).toContain('Bloquer à partir d’ici');
    await toucher(arbre, 'fin-22:00');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Bloquer de 20 h à 22 h (1 créneau)',
      '1 créneau de cette plage est réservé : il ne sera pas bloqué.',
    ]));
    await ecrire(arbre, 'Motif (facultatif)', 'Entretien du gazon');
    await toucher(arbre, 'plage-bloquer');
    expect(mockBloquer).toHaveBeenCalledWith({
      blocage: {
        date: JOUR, from: '20:00', motif: 'Entretien du gazon', to: '22:00',
      },
      terrainId: 't-1',
    });
  });

  it('un créneau bloqué : « Débloquer » rouvre sa fermeture', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-2-2026-10-16-18:00');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Bloqué : entretien', 'Terrain 2 · vendredi 16/10 · 18 h – 19 h',
    ]));
    await toucher(arbre, 'creneau-debloquer');
    expect(mockRouvrir).toHaveBeenCalledWith(['f-1']);
    expect(lisibles(arbre)).toContain('Créneau débloqué.');
  });
});

describe('RESA-L5A2 E-G03 — vers les fermetures (E-G10)', () => {
  it('« Fermer des jours », au pied du planning', async () => {
    const arbre = await monter();
    await toucher(arbre, 'planning-fermer-des-jours');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeFermetures, {
      complexeId: 'cx-five', terrainId: undefined,
    });
  });

  it('un créneau fermé : son motif, et « Voir les fermetures » de ce terrain', async () => {
    const arbre = await monter();
    await toucher(arbre, 'creneau-t-3-2026-10-16-18:00');
    expect(lisibles(arbre)).toContain('Fermé : travaux');
    await toucher(arbre, 'creneau-voir-fermetures');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeFermetures, {
      complexeId: 'cx-five', terrainId: 't-3',
    });
  });
});

describe('RESA-L5A2 E-G03 — vues Semaine et Liste (états 2, 9 bis)', () => {
  it('Semaine : un terrain, du lundi au dimanche', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Semaine');
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({
      from: '2026-10-12', terrain: 't-1', to: '2026-10-18',
    });
    expect(lisibles(arbre)).toContain('12 – 18 octobre');
  });

  it('sur ordinateur, la semaine d’abord (site, rubrique 9)', async () => {
    mockOrdinateur = true;
    await monter();
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({
      from: '2026-10-12', terrain: 't-1', to: '2026-10-18',
    });
  });

  it('Liste : les créneaux occupés, jour par jour', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Liste');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '18 h – 19 h · Terrain 1',
      'Julien M. · App',
      '18 h – 19 h · Terrain 2',
      'Bloqué : entretien',
    ]));
  });
});

describe('RESA-L5A2 E-G03 — aucun terrain, chargement, erreur (états 5 à 7)', () => {
  it('aucun terrain : « Ajouter un terrain » ouvre E-G08', async () => {
    mockTerrains = { data: [], isLoading: false };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ajoute un terrain pour voir ton planning.');
    await appuyer(arbre, 'Ajouter un terrain');
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.ComplexeTerrain, { complexeId: 'cx-five' });
  });

  it('chargement : la grille en squelette ; erreur : « Réessayer »', async () => {
    mockPlanning = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'planning-squelette')).not.toBeNull();
    const refetch = jest.fn();
    mockPlanning = {
      data: undefined, error: new Error('boum'), isLoading: false, refetch,
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger le planning.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
