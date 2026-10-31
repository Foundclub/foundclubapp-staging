import renderer, { act } from 'react-test-renderer';

import ComplexeClient from '@/views/complexe/ComplexeClient';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// CORR-RESA (76 A, 31/10/2026) — E-G15, la feuille « Bannir » : « Bannir » reste gris sans
// raison ; le libellé du champ dit « obligatoire ». Doublures recopiées de
// EG15.client.L5B1.test.js.

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five', joueurId: 'u-julien' } }),
}));

jest.mock('@/services/complexe/complexeQueries', () => ({
  useBannir: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useClientDuComplexe: () => ({
    data: {
      ban: null,
      documentId: 'u-julien',
      firstname: 'Julien',
      lastname: 'Marchal',
      lateCancellations: 0,
      noShows: 1,
      upcoming: 2,
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useClientsDuComplexe: () => ({ data: undefined, isLoading: false }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: { rules: { autoBanNoShows: 3 } } }),
  useDebannir: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useFideliteDuComplexe: () => ({ data: null, isLoading: false }),
  useHistoriqueClient: () => ({ data: undefined, isLoading: false }),
  useReservationGeree: () => ({ data: undefined, isLoading: false }),
  useValiderRecompense: () => ({ isPending: false, mutateAsync: jest.fn() }),
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
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
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

const RAISON = 'Raison (obligatoire, privée, jamais montrée à Julien)';

/**
 * Monte la fiche et ouvre la feuille « Bannir ».
 * @returns {Promise<any>} L'arbre.
 */
const ouvrirLeBan = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeClient />);
  });
  const cible = parRepere(arbre, 'client-bannir')
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
  return arbre;
};

describe('CORR-RESA (76 A) E-G15 — la raison du ban est dite obligatoire', () => {
  it('le champ s’appelle « Raison (obligatoire, privée, jamais montrée à Julien) »', async () => {
    const arbre = await ouvrirLeBan();
    expect(lisibles(arbre)).toContain('Bannir Julien M.');
    const champs = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === RAISON && typeof n.props?.onChangeText === 'function'
    ));
    expect(champs.length).toBeGreaterThan(0);
  });

  it('l’ancien libellé sans « obligatoire » n’est plus là', async () => {
    const arbre = await ouvrirLeBan();
    expect(arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Raison (privée, jamais montrée à Julien)'
    ))).toHaveLength(0);
  });
});
