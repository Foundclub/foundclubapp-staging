import renderer, { act } from 'react-test-renderer';

import ComplexeReglages from '@/views/complexe/ComplexeReglages';

import {
  COMPLEXE_FIVE,
  lisibles,
  pressable,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G16 « Les réglages du complexe » (planches EG16 et RA6) : qui peut
// réserver, annuler et réserver, le mot aux joueurs, les collectes, les non honorées, les
// notifications ; « Enregistrer » envoie les règles au serveur (contrat L1, `PUT …/manage`).

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

// COMPLEXE-TERRAINS (10/11/2026, point 9, décision d'Adel relayée par le chef, ligne Gérant 05,
// M0860) : le réglage « Réservations à venir par personne » est SUPPRIMÉ (le serveur ne le lit
// plus) ; un « ? » explique les réglages qui ne s'expliquent pas d'eux-mêmes, d'une même bulle.
describe('COMPLEXE-TERRAINS (9) — Réglages du complexe', () => {
  it('le réglage « Réservations à venir par personne » et sa phrase ont disparu', async () => {
    const arbre = await monter();
    const textes = lisibles(arbre).join(' | ');
    expect(textes).not.toContain('Réservations à venir par personne');
    expect(textes).not.toContain('Les demandes et les collectes en cours comptent.');
    expect(textes).toContain('Réserver au plus tard');
  });

  it.each([
    [
      'Date limite de collecte au plus tard',
      // eslint-disable-next-line max-len
      'Une collecte attend que ses joueurs la rejoignent. Elle doit être complète au plus tard ce délai avant le créneau ; sinon elle s’arrête et le créneau reste libre.',
    ],
    [
      'Réserver au plus tard',
      'Un joueur ne peut plus réserver un créneau qui commence dans moins de ce délai.',
    ],
    [
      'Bannir automatiquement après',
      // eslint-disable-next-line max-len
      'Une réservation non honorée : le joueur n’est pas venu. À ce nombre, il ne peut plus réserver chez toi.',
    ],
  ])('le « ? » de « %s » ouvre puis referme son explication', async (reglage, explication) => {
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain(explication);
    await appuyer(arbre, `Aide : ${reglage}`);
    expect(lisibles(arbre)).toContain(explication);
    await appuyer(arbre, `Aide : ${reglage}`);
    expect(lisibles(arbre)).not.toContain(explication);
  });
});
