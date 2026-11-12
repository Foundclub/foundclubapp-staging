import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { creneau, recapitulatif } from '@/testSupport/temoinReserver';

// DT-3 (DUREES-TARIFS, 12/11/2026) — maquette validée par Adel le 12/11 (« 280- validée »,
// version 3), écran J1 : quand le terrain propose plusieurs durées ce jour-là (le serveur DT-1
// ajoute `offers: [{ durationMinutes, slots }]`), un choix « 1 h · 2 h » au-dessus des lignes ;
// il s'ouvre sur la plus courte ; les lignes (heures, prix, état) sont celles de la durée choisie ;
// « Continuer » envoie le `durationMinutes` DU CRÉNEAU (un ponctuel d'1 h 30 rangé dans la 1re
// offre part avec 90). Une seule durée (pas de clé `offers`) : l'écran et la demande d'avant, à
// l'identique (témoin caractérisant, vert avant ET après).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockCreneauxParJour = /** @type {Record<string, any>} */ ({});
const mockRelire = jest.fn();
const mockApercu = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useCreneauxDuJour: (
    /** @type {any} */ _slug,
    /** @type {any} */ _terrain,
    /** @type {string} */ date,
  ) => mockCreneauxParJour[date] || {
    data: { date, slots: [] }, isLoading: false, refetch: mockRelire,
  },
  useTerrainsPublics: () => ({
    data: [jest.requireActual('@/testSupport/temoinReserver').terrainPublic({ photos: [] })],
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1990-01-01', documentId: 'u-1' } }),
}));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const JOUR = '2026-10-14';

/**
 * Un créneau d'une offre, comme le serveur DT-1 le rend (sa durée réelle).
 * @param {string} from - Début.
 * @param {string} to - Fin.
 * @param {number} montant - Le prix.
 * @param {number} minutes - Sa durée.
 * @param {string} [etat] - L'état.
 * @returns {any} Le créneau.
 */
const offert = (from, to, montant, minutes, etat = 'libre') => creneau(from, to, etat, {
  durationMinutes: minutes,
  price: { amount: montant, perPlayer: montant / 10, unit: 'creneau' },
});

/**
 * La lecture d'un jour, avec ou sans `offers`.
 * @param {any[]} slots - La grille de la plus courte (ce que lit un 2.6.99).
 * @param {any[] | null} offers - Les offres, ou null (une seule durée).
 * @returns {any} La lecture.
 */
const jour = (slots, offers) => ({
  data: {
    date: JOUR,
    ...(offers ? { offers } : {}),
    slots,
    terrain: {
      bookingMode: 'automatique', capacity: 10, documentId: 't-1', name: 'Terrain 1', phone: null,
    },
  },
  isLoading: false,
  refetch: mockRelire,
});

const UNE_HEURE = [
  offert('17:00', '18:00', 80, 60),
  offert('18:00', '19:00', 100, 60),
  offert('19:00', '20:00', 100, 60, 'pris'),
  offert('20:00', '21:00', 100, 60),
  // Un ponctuel d'1 h 30, rangé par le serveur dans la 1re offre avec sa vraie durée.
  offert('22:00', '23:30', 150, 90),
];
const DEUX_HEURES = [
  offert('17:00', '19:00', 140, 120),
  offert('18:00', '20:00', 180, 120, 'pris'),
  offert('19:00', '21:00', 180, 120, 'pris'),
  offert('20:00', '22:00', 180, 120),
];

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverCreneau />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud pressable.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

// Les repères distincts (l'arbre de témoin porte le repère sur le composant ET son dessin).
const ongletsDeDuree = (/** @type {any} */ arbre) => [...new Set(arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.testID === 'string'
    && n.props.testID.startsWith('duree-'),
).map((/** @type {any} */ n) => n.props.testID))];

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage', terrainId: 't-1' };
  mockApercu.mockResolvedValue(recapitulatif({ date: JOUR }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DT-3 — E-P03, une seule durée : l’écran d’aujourd’hui (caractérisant)', () => {
  beforeEach(() => {
    mockCreneauxParJour = {
      [JOUR]: jour([creneau('18:00', '19:00'), creneau('19:00', '20:00', 'pris')], null),
    };
  });

  it('aucun choix de durée, les lignes de `slots`', async () => {
    const arbre = await monter();
    expect(ongletsDeDuree(arbre)).toHaveLength(0);
    expect(parRepere(arbre, 'durees-du-creneau')).toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '18 h – 19 h', '19 h – 20 h', '60 €', 'Libre', 'Pris',
    ]));
  });

  it('« Continuer » envoie la demande d’avant, sans durée', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-18:00'));
    await toucher(arbre.root.find((/** @type {any} */ n) => n.props?.title === 'Continuer'));
    expect(mockApercu).toHaveBeenCalledWith({ date: JOUR, from: '18:00', terrain: 't-1' });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverRecapitulatif, {
      apercu: expect.any(Object),
      date: JOUR,
      from: '18:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    });
  });
});

describe('DT-3 — J1 : choisir la durée', () => {
  beforeEach(() => {
    mockCreneauxParJour = {
      [JOUR]: jour(UNE_HEURE, [
        { durationMinutes: 60, slots: UNE_HEURE },
        { durationMinutes: 120, slots: DEUX_HEURES },
      ]),
    };
  });

  it('« 1 h » et « 2 h », chacune « dès » son prix le plus bas ; la plus courte', async () => {
    const arbre = await monter();
    expect(ongletsDeDuree(arbre)).toHaveLength(2);
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '1 h', 'dès 80 €', '2 h', 'dès 140 €',
    ]));
    expect(parRepere(arbre, 'duree-60').props.accessibilityState).toEqual({ selected: true });
    expect(parRepere(arbre, 'duree-120').props.accessibilityState).toEqual({ selected: false });
    // Les lignes d'1 h, rien de la 2 h.
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['17 h – 18 h', '22 h – 23 h 30']));
    expect(lisibles(arbre)).not.toContain('17 h – 19 h');
  });

  it('« 2 h » montre les créneaux de 2 h avec leur prix ; les recouverts sont pris', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'duree-120'));
    expect(parRepere(arbre, 'duree-120').props.accessibilityState).toEqual({ selected: true });
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      '17 h – 19 h', '140 €', '18 h – 20 h', '19 h – 21 h', '20 h – 22 h', '180 €',
    ]));
    expect(vus).not.toContain('17 h – 18 h');
    expect(parRepere(arbre, 'creneau-18:00-120').props.disabled).toBe(true);
  });

  it('« Continuer » envoie la durée DU CRÉNEAU, et le récapitulatif la reçoit', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'duree-120'));
    await toucher(parRepere(arbre, 'creneau-20:00-120'));
    expect(lisibles(arbre)).toContain('Mercredi 14/10 · 20 h – 22 h');
    await toucher(arbre.root.find((/** @type {any} */ n) => n.props?.title === 'Continuer'));
    expect(mockApercu).toHaveBeenCalledWith({
      date: JOUR, durationMinutes: 120, from: '20:00', terrain: 't-1',
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.ReserverRecapitulatif,
      expect.objectContaining({ durationMinutes: 120, from: '20:00' }),
    );
  });

  it('un ponctuel d’1 h 30 dans l’offre d’1 h part avec 90', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-22:00-90'));
    await toucher(arbre.root.find((/** @type {any} */ n) => n.props?.title === 'Continuer'));
    expect(mockApercu).toHaveBeenCalledWith({
      date: JOUR, durationMinutes: 90, from: '22:00', terrain: 't-1',
    });
  });

  it('changer de durée vide le choix', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-17:00-60'));
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.title === 'Continuer'))
      .not.toHaveLength(0);
    await toucher(parRepere(arbre, 'duree-120'));
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.title === 'Continuer'))
      .toHaveLength(0);
  });

  it('arrivé avec un créneau de 2 h (page du complexe), l’onglet 2 h s’ouvre', async () => {
    mockParams = {
      date: JOUR,
      from: '20:00',
      slug: 'le-five-de-montrivage',
      startsAt: '2026-10-14T20:00:00.000Z',
      terrainId: 't-1',
    };
    // Deux plages de durées différentes : `slots` mélange la plus courte de chacune (DT-1).
    mockCreneauxParJour = {
      [JOUR]: jour([UNE_HEURE[0], DEUX_HEURES[3]], [
        { durationMinutes: 60, slots: [UNE_HEURE[0]] },
        { durationMinutes: 120, slots: [DEUX_HEURES[3]] },
      ]),
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'duree-120').props.accessibilityState).toEqual({ selected: true });
    expect(lisibles(arbre)).toContain('Mercredi 14/10 · 20 h – 22 h');
  });
});
