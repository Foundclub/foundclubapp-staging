import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeReglages from '@/views/complexe/ComplexeReglages';

import {
  COMPLEXE_FIVE,
  lisibles,
  pressable,
} from '@/testSupport/temoinComplexe';

// REGLES-COMPLEXES (10/11/2026, « 225- A ») — relire les règles d'utilisation depuis les
// Réglages du complexe (E-G16). Le lien, en bas de l'écran, ouvre la page publique des règles ;
// il n'enregistre rien.

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

describe('REGLES-COMPLEXES — relire les règles depuis les Réglages', () => {
  it('« Lire les règles… » en bas, après « Enregistrer », ouvre la page', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const arbre = await monter();
    const lus = lisibles(arbre);
    const libelle = 'Lire les règles d’utilisation des complexes';
    expect(lus).toContain(libelle);
    expect(lus.indexOf(libelle)).toBeGreaterThan(lus.indexOf('Enregistrer'));
    expect(pressable(arbre, libelle).props.accessibilityRole).toBe('link');
    await appuyer(arbre, libelle);
    expect(ouvrir).toHaveBeenCalledTimes(1);
    expect(ouvrir.mock.calls[0]).toHaveLength(1);
    expect(ouvrir.mock.calls[0][0]).toMatch(/^https:\/\/[^/]+\/regles-complexes$/);
    // Rien n'est envoyé : relire n'enregistre pas.
    expect(mockModifier).not.toHaveBeenCalled();
    ouvrir.mockRestore();
  });
});
