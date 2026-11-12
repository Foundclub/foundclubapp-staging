/* eslint-disable max-len -- témoins DT-2 : libellés et données d'exemple écrits en entier, comme à l'écran. */
import { StyleSheet, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeCreneaux from '@/views/complexe/ComplexeCreneaux';

import {
  lisibles,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// DT-2 (12/11/2026) — DUREES-TARIFS, écran du GÉRANT « Créneaux et tarifs » (maquette validée par
// Adel le 12/11, version 3 : G1, G2, G2 bis, G3, G3 bis ; décisions 280 A, 281 A, 282) et ligne 09
// de la recette du 12/11 (D85 : « quand on veut ajouter une deuxième plage, on ne voit pas la
// première »). Serveur : DT-1 (admin 02fb37ea) — `ranges[].durations`, `ranges[].starts`,
// `rates[].durationMinutes`, `priceStraddle` envoyé dans CHAQUE PUT.

let mockParams = /** @type {any} */ ({ complexeId: 'cx-five', terrainId: 't-1' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

let mockTerrains = /** @type {any} */ ({});
const mockApercu = jest.fn();
const mockEnregistrer = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuCreneaux: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useEnregistrerCreneaux: () => ({ isPending: false, mutateAsync: mockEnregistrer }),
  useTerrains: () => mockTerrains,
}));

jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseHeure(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
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
    arbre = renderer.create(<ComplexeCreneaux />);
  });
  return arbre;
};

/**
 * Le nœud pressable dont le libellé d'accessibilité est EXACTEMENT celui-là.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {any} Le nœud.
 */
const exact = (arbre, libelle) => {
  const [noeud] = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function' && typeof n.type !== 'string'
    && String(n.props?.accessibilityLabel || '')
      .split(String.fromCharCode(160)).join(' ') === libelle
  ));
  if (!noeud) throw new Error(`Aucun pressable « ${libelle} »`);
  return noeud;
};

/**
 * Appuie sur un élément par son libellé (contenu).
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

/**
 * Appuie sur l'élément de CE libellé exact.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const cocher = async (arbre, libelle) => {
  await act(async () => {
    await exact(arbre, libelle).props.onPress();
  });
};

/**
 * Appuie sur un élément par son repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (arbre, testID) => {
  const noeud = parRepere(arbre, testID);
  if (!noeud) throw new Error(`Aucun repère « ${testID} »`);
  await act(async () => {
    await noeud.props.onPress();
  });
};

/**
 * Écrit dans un champ, par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @param {string} texte - Le texte.
 * @returns {Promise<void>} Fini.
 */
const ecrire = async (arbre, libelle, texte) => {
  const [champ] = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
    && n.props.accessibilityLabel === libelle);
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

const DEPARTS_HORAIRES = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const SEMAINE = {
  days: [1, 2, 3, 4, 5],
  durationMinutes: 60,
  durations: [60, 120],
  from: '17:00',
  starts: DEPARTS_HORAIRES,
  to: '23:00',
};
const WEEKEND = {
  days: [6, 7], durationMinutes: 120, from: '10:00', to: '22:00',
};
const PLAN_DEUX_DUREES = {
  extraSlots: [],
  period: { from: '2026-11-12', until: null },
  ranges: [SEMAINE, WEEKEND],
  rates: [
    {
      days: [1, 2, 3, 4, 5], durationMinutes: 120, from: '17:00', price: 14, to: '18:00',
    },
    { days: [6, 7], durationMinutes: 120, price: 16 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
  mockTerrains = {
    data: [terrainDeTemoin({
      basePrice: 10,
      creneaux: {
        openSlots: null, ranges: [], slotsPerWeek: 40, status: 'ouvert',
      },
      priceUnit: 'joueur',
      slotPlan: PLAN_DEUX_DUREES,
    })],
    isLoading: false,
  };
  mockApercu.mockImplementation(async ({ plan }) => ({
    data: {
      creneaux: {
        openSlots: 500, ranges: [], slotsPerWeek: 40, status: 'ouvert',
      },
      dryRun: true,
      slotPlan: {
        extraSlots: plan.extraSlots, period: plan.period, ranges: plan.ranges, rates: plan.rates,
      },
    },
  }));
  mockEnregistrer.mockResolvedValue({
    data: {
      creneaux: {
        openSlots: 480, ranges: [], slotsPerWeek: 40, status: 'ouvert',
      },
    },
  });
});

describe('DT-2 G1 — la semaine en bandes, les plages avec leurs durées et leurs départs', () => {
  it('« LA SEMAINE » : une bande par plage, chaque jour ; la plage dit ses durées et ses départs', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'LA SEMAINE',
      'Touche une bande pour modifier sa plage.',
      '17 h – 23 h · créneaux de 1 h ou 2 h',
      'Départs toutes les heures, de 17 h à 22 h',
      '10 h – 22 h · créneaux de 2 h · 6 créneaux',
    ]));
    expect(parRepere(arbre, 'complexe-creneaux-bande-1-0')).not.toBeNull();
    expect(parRepere(arbre, 'complexe-creneaux-bande-6-1')).not.toBeNull();
    expect(parRepere(arbre, 'complexe-creneaux-bande-6-0')).toBeNull();
    expect(lus).toContain('17–23 · 1 h, 2 h');
  });

  it('toucher une bande rouvre SA plage ; « Valider » la remplace, sans en ajouter', async () => {
    const arbre = await monter();
    await toucher(arbre, 'complexe-creneaux-bande-3-0');
    const lus = lisibles(arbre);
    expect(lus).toContain('Plage du lun. au ven.');
    expect(exact(arbre, 'Durées proposées : 1 h').props.accessibilityState.checked).toBe(true);
    expect(exact(arbre, 'Durées proposées : 2 h').props.accessibilityState.checked).toBe(true);
    expect(exact(arbre, 'Départs : Toutes les heures').props.accessibilityState.selected).toBe(true);
    // La semaine reste visible dans la feuille, la plage en cours en pointillé.
    expect(parRepere(arbre, 'complexe-creneaux-feuille-bande-1-en-cours')).not.toBeNull();
    await ecrire(arbre, 'Fermeture', '22:00');
    await appuyer(arbre, 'Valider la plage');
    const { ranges } = mockApercu.mock.calls[0][0].plan;
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({
      ...SEMAINE, starts: ['17:00', '18:00', '19:00', '20:00', '21:00'], to: '22:00',
    });
    expect(ranges[1]).toEqual(WEEKEND);
  });

  it('toucher la ligne d’une plage la rouvre aussi', async () => {
    const arbre = await monter();
    await cocher(arbre, 'Modifier : Sam. · dim.');
    expect(lisibles(arbre)).toContain('Plage du sam. · dim.');
  });
});

describe('DT-2 G2 — une plage à plusieurs durées et ses départs', () => {
  beforeEach(() => {
    mockTerrains.data[0].slotPlan = { ...PLAN_DEUX_DUREES, ranges: [WEEKEND], rates: [] };
  });

  it('1 h et 2 h, toutes les heures : « Ce que verront les joueurs », puis l’envoi', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await [1, 2, 3, 4, 5].reduce(
      (avant, jour) => avant.then(() => toucher(arbre, `complexe-creneaux-jour-${jour}`)),
      Promise.resolve(),
    );
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '23:00');
    await cocher(arbre, 'Durées proposées : 2 h');
    await cocher(arbre, 'Départs : Toutes les heures');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'CE QUE VERRONT LES JOUEURS',
      '1 h : 6 créneaux, de 17 h – 18 h à 22 h – 23 h',
      '2 h : 5 créneaux, de 17 h – 19 h à 21 h – 23 h',
      'Un départ trop tard pour une durée ne la propose pas.',
    ]));
    await appuyer(arbre, 'Ajouter la plage');
    expect(mockApercu.mock.calls[0][0].plan.ranges[1]).toEqual({
      days: [1, 2, 3, 4, 5],
      durationMinutes: 60,
      durations: [60, 120],
      from: '17:00',
      starts: DEPARTS_HORAIRES,
      to: '23:00',
    });
  });

  it('une seule durée, départs « À la suite » : la plage d’avant, clé pour clé', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    expect(exact(arbre, 'Départs : À la suite').props.accessibilityState.selected).toBe(true);
    await toucher(arbre, 'complexe-creneaux-jour-1');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '23:00');
    expect(lisibles(arbre)).toContain('6 créneaux de 1 h');
    expect(lisibles(arbre)).not.toContain('CE QUE VERRONT LES JOUEURS');
    await appuyer(arbre, 'Ajouter la plage');
    expect(mockApercu.mock.calls[0][0].plan.ranges[1]).toEqual({
      days: [1], durationMinutes: 60, from: '17:00', to: '23:00',
    });
  });

  it('aucune durée cochée : refus dans la feuille, rien n’est envoyé', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-1');
    await cocher(arbre, 'Durées proposées : 1 h');
    await appuyer(arbre, 'Ajouter la plage');
    expect(lisibles(arbre)).toContain('Choisis au moins une durée.');
    expect(mockApercu).not.toHaveBeenCalled();
  });
});

describe('DT-2 G2 bis — départs « Je choisis » et chevauchement en rouge (ligne 09)', () => {
  beforeEach(() => {
    mockTerrains.data[0].slotPlan = {
      ...PLAN_DEUX_DUREES,
      ranges: [{
        days: [1, 2, 4, 5], durationMinutes: 60, from: '14:00', to: '23:00',
      }],
      rates: [],
    };
  });

  it('la 2ᵉ plage chevauche la 1ʳᵉ le vendredi : la bande passe au rouge et c’est écrit', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-5');
    await toucher(arbre, 'complexe-creneaux-jour-6');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '23:00');
    expect(parRepere(arbre, 'complexe-creneaux-feuille-bande-5-0-chevauche')).not.toBeNull();
    expect(parRepere(arbre, 'complexe-creneaux-feuille-bande-4-0-chevauche')).toBeNull();
    expect(lisibles(arbre)).toContain(
      'Vendredi, cette plage chevauche « Lun. · mar. · jeu. · ven., 14 h – 23 h ». Décoche V, ou change les heures.',
    );
    await toucher(arbre, 'complexe-creneaux-jour-5');
    expect(parRepere(arbre, 'complexe-creneaux-feuille-bande-5-0-chevauche')).toBeNull();
  });

  it('« Je choisis » : le gérant coche ses départs à la demi-heure', async () => {
    mockTerrains.data[0].slotPlan.ranges = [];
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-6');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '23:00');
    await cocher(arbre, 'Durées proposées : 1 h 30');
    await cocher(arbre, 'Durées proposées : 1 h');
    await cocher(arbre, 'Départs : Je choisis');
    await ['17 h', '18 h 30', '20 h', '21 h 30'].reduce(
      (avant, heure) => avant.then(() => cocher(arbre, `Départ de ${heure}`)),
      Promise.resolve(),
    );
    await appuyer(arbre, 'Ajouter la plage');
    expect(mockApercu.mock.calls[0][0].plan.ranges[0]).toEqual({
      days: [6], durationMinutes: 90, from: '17:00', starts: ['17:00', '18:30', '20:00', '21:30'], to: '23:00',
    });
  });
});

describe('DT-2 G3 / G3 bis — les prix par durée, l’italique, « Pour quelle durée »', () => {
  it('un onglet par durée ; 2 h sans tarif = 2 × le prix d’1 h, en italique', async () => {
    const arbre = await monter();
    await cocher(arbre, 'Durée des prix : 2 h');
    const calcule = parRepere(arbre, 'complexe-creneaux-prix-1-18:00');
    expect(calcule).not.toBeNull();
    const texte = calcule.findAllByType(Text)[0];
    expect(StyleSheet.flatten(texte.props.style).fontStyle).toBe('italic');
    expect(lisibles(arbre)).toContain('20 €');
    expect(parRepere(arbre, 'complexe-creneaux-prix-1-17:00').props.onPress).toBeUndefined();
  });

  it('toucher une case en italique ouvre « Nouveau tarif » prérempli ; le tarif part avec sa durée', async () => {
    const arbre = await monter();
    await cocher(arbre, 'Durée des prix : 2 h');
    await toucher(arbre, 'complexe-creneaux-prix-1-18:00');
    expect(lisibles(arbre)).toContain('Nouveau tarif');
    expect(exact(arbre, 'Pour quelle durée : 2 h').props.accessibilityState.selected).toBe(true);
    expect(exact(arbre, 'lundi').props.accessibilityState.checked).toBe(true);
    await ecrire(arbre, 'Prix', '18');
    await appuyer(arbre, 'Ajouter le tarif');
    expect(mockApercu.mock.calls[0][0].plan.rates[2]).toEqual({
      // La tranche touchée : 18 h – 22 h (le week-end ferme à 22 h, la grille y coupe).
      days: [1], durationMinutes: 120, from: '18:00', price: 18, to: '22:00',
    });
  });

  it('la ligne d’un tarif dit sa durée', async () => {
    const arbre = await monter();
    expect(lisibles(arbre).filter((texte) => texte === 'Pour 2 h')).toHaveLength(2);
  });

  it('aucune plage à plusieurs durées : ni onglet, ni « Pour quelle durée » (comme avant)', async () => {
    mockTerrains.data[0].slotPlan = PLAN_OUVERT;
    const arbre = await monter();
    expect(() => exact(arbre, 'Durée des prix : 1 h')).toThrow();
    await appuyer(arbre, 'Ajouter un tarif');
    expect(() => exact(arbre, 'Pour quelle durée : Toutes')).toThrow();
  });
});

describe('DT-2 — prix d’un créneau à cheval, et `priceStraddle` dans CHAQUE envoi', () => {
  it('« Prix de la fin » part avec « Enregistrer »', async () => {
    const arbre = await monter();
    expect(exact(arbre, 'Un créneau à cheval sur deux tarifs : Prix du début')
      .props.accessibilityState.selected).toBe(true);
    await cocher(arbre, 'Un créneau à cheval sur deux tarifs : Prix de la fin');
    expect(parRepere(arbre, 'complexe-creneaux-non-enregistre')).not.toBeNull();
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer.mock.calls[0][0].plan).toEqual({ ...PLAN_DEUX_DUREES, priceStraddle: 'fin' });
  });

  it('le choix enregistré se relit ; l’aperçu l’envoie aussi, même inchangé', async () => {
    mockTerrains.data[0].priceStraddle = 'fin';
    const arbre = await monter();
    expect(exact(arbre, 'Un créneau à cheval sur deux tarifs : Prix de la fin')
      .props.accessibilityState.selected).toBe(true);
    await cocher(arbre, 'Retirer : Sam. · dim.');
    expect(mockApercu.mock.calls[0][0].plan.priceStraddle).toBe('fin');
  });
});
