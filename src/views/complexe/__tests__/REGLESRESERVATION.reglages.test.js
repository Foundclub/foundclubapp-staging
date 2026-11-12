/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ComplexeReglages from '@/views/complexe/ComplexeReglages';

import {
  COMPLEXE_FIVE,
  lisibles,
  pressable,
} from '@/testSupport/temoinComplexe';

// REGLES-RESERVATION (12/11/2026) — deux règles que le gérant règle lui-même (demandes d'Adel du
// 10/11, maquette DESIGN-RESA-JOUEUR « Réserver à l'avance ») :
//   · D47 « Réserver à l'avance » : « Sans limite (jusqu'à l'heure du créneau) » présélectionné
//     (serveur : 90 jours), ou « Jusqu'à N jours à l'avance » (`bookingDaysAhead`, 1 à 89) ;
//   · « 226 » / « 229- B » : l'échéance d'une réservation en construction « Jusqu'à l'heure du
//     créneau » (`collectDeadlineHours = 0`) ou « Plus tôt » (x h avant le créneau).

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

const REGLES = {
  autoBanNoShows: 3,
  cancellationDelayHours: 24,
  collectDeadlineHours: 24,
  dayBeforeConfirmation: true,
  maxUpcomingPerUser: 2,
  minAge: 18,
  minLeadTimeHours: 2,
  morningDigest: true,
};

let mockComplexe = /** @type {any} */ ({});
const mockModifier = jest.fn();
const mockRelire = jest.fn();
// RESA-L5B-1, partie B (B4) — l'aperçu d'un âge minimum relevé (`PUT …/manage`, `dryRun`).
const mockApercuAge = /** @type {any} */ ({ data: undefined });
/** @type {any[]} */
const mockApercusAge = [];
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuAgeMinimum: (/** @type {any[]} */ ...args) => {
    mockApercusAge.push(args);
    return mockApercuAge;
  },
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => mockComplexe,
  useModifierComplexe: () => ({ isPending: false, mutateAsync: mockModifier }),
}));

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
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
    arbre = renderer.create(<ComplexeReglages />);
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
    await pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockComplexe = {
    data: { ...COMPLEXE_FIVE, playersNote: null, rules: { ...REGLES } },
    isLoading: false,
    refetch: mockRelire,
  };
  mockModifier.mockResolvedValue({ data: {} });
});

/**
 * Le choix pressé d'un groupe de puces (`ChoiceChipGroup` : « titre : option »).
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - « titre : option ».
 * @returns {boolean} Choisi ?
 */
const choisi = (arbre, libelle) => Boolean(pressable(arbre, libelle).props.accessibilityState?.selected);

const AVANCE = 'Jusqu’à quand un joueur peut-il réserver ?';
const ECHEANCE = 'Une réservation en construction attend ses joueurs';

describe('REGLES-RESERVATION — Réserver à l’avance (D47)', () => {
  it('sans réglage : « Sans limite » est présélectionné et le nombre de jours n’apparaît pas', async () => {
    const arbre = await monter();
    const textes = lisibles(arbre).join(' | ');
    expect(textes).toContain('RÉSERVER À L’AVANCE');
    expect(choisi(arbre, `${AVANCE} : Sans limite (jusqu’à l’heure du créneau)`)).toBe(true);
    expect(choisi(arbre, `${AVANCE} : Jusqu’à N jours à l’avance`)).toBe(false);
    expect(textes).not.toContain('Nombre de jours');
  });

  it('« Jusqu’à N jours » propose 14 jours, le compteur règle N, « Enregistrer » envoie bookingDaysAhead', async () => {
    const arbre = await monter();
    await appuyer(arbre, `${AVANCE} : Jusqu’à N jours à l’avance`);
    expect(lisibles(arbre)).toContain('14 jours');
    await appuyer(arbre, 'Moins : Nombre de jours');
    expect(lisibles(arbre)).toContain('13 jours');
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier.mock.calls[0][0].donnees).toEqual(expect.objectContaining({ bookingDaysAhead: 13 }));
  });

  it('un complexe à 7 jours relit 7 jours ; « Sans limite » renvoie 90', async () => {
    mockComplexe.data.rules = { ...REGLES, bookingDaysAhead: 7 };
    const arbre = await monter();
    expect(choisi(arbre, `${AVANCE} : Jusqu’à N jours à l’avance`)).toBe(true);
    expect(lisibles(arbre)).toContain('7 jours');
    await appuyer(arbre, `${AVANCE} : Sans limite (jusqu’à l’heure du créneau)`);
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier.mock.calls[0][0].donnees).toEqual(expect.objectContaining({ bookingDaysAhead: 90 }));
  });
});

describe('REGLES-RESERVATION — l’échéance d’une réservation en construction (226)', () => {
  it('un complexe existant à 24 h : « Plus tôt » est choisi, son compteur reste ; « Jusqu’à l’heure du créneau » envoie 0', async () => {
    const arbre = await monter();
    expect(choisi(arbre, `${ECHEANCE} : Plus tôt`)).toBe(true);
    expect(lisibles(arbre)).toContain('24 h avant le créneau');
    await appuyer(arbre, `${ECHEANCE} : Jusqu’à l’heure du créneau`);
    expect(lisibles(arbre)).not.toContain('24 h avant le créneau');
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier.mock.calls[0][0].donnees).toEqual(expect.objectContaining({ collectDeadlineHours: 0 }));
  });

  it('un complexe à 0 relit « Jusqu’à l’heure du créneau » ; « Plus tôt » propose 24 h, que le compteur règle (1 h au moins)', async () => {
    mockComplexe.data.rules = { ...REGLES, collectDeadlineHours: 0 };
    const arbre = await monter();
    expect(choisi(arbre, `${ECHEANCE} : Jusqu’à l’heure du créneau`)).toBe(true);
    await appuyer(arbre, `${ECHEANCE} : Plus tôt`);
    expect(lisibles(arbre)).toContain('24 h avant le créneau');
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier.mock.calls[0][0].donnees).toEqual(expect.objectContaining({ collectDeadlineHours: 24 }));
  });
});
