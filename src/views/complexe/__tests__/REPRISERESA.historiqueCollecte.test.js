import renderer, { act } from 'react-test-renderer';

import ComplexeClient from '@/views/complexe/ComplexeClient';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// REPRISE-RESA (01/11/2026, D-GERANT-3 de la contre-recette du gérant) — E-G15, l'« Historique »
// d'un client : une ligne de collecte n'avait AUCUN état (la pastille restait vide). Chaque
// ligne dit maintenant « En collecte » ou « Non aboutie ». Doublures recopiées de
// CORRRESA.client.test.js.

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
  useHistoriqueClient: () => ({
    data: {
      parties: 1,
      reservations: [
        {
          documentId: 'r-collecte',
          endsAt: '2026-11-07T19:30:00.000Z',
          source: 'app',
          startsAt: '2026-11-07T18:00:00.000Z',
          status: 'en_collecte',
          terrain: { name: 'Terrain 1' },
        },
        {
          documentId: 'r-arretee',
          endsAt: '2026-10-31T19:30:00.000Z',
          source: 'app',
          startsAt: '2026-10-31T18:00:00.000Z',
          status: 'non_aboutie',
          terrain: { name: 'Terrain 2' },
        },
      ],
    },
    isLoading: false,
  }),
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

/**
 * Monte la fiche du client.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeClient />);
  });
  return arbre;
};

describe('REPRISE-RESA (D-GERANT-3) — l’historique d’un client dit l’état de ses collectes', () => {
  it('« En collecte » et « Non aboutie », chacune sur sa ligne', async () => {
    const arbre = await monter();
    const enCours = parRepere(arbre, 'client-historique-r-collecte');
    const arretee = parRepere(arbre, 'client-historique-r-arretee');
    expect(lisibles({ root: enCours })).toContain('En collecte');
    expect(lisibles({ root: arretee })).toContain('Non aboutie');
    expect(parRepere({ root: enCours }, 'pastille-etat-en_collecte')).not.toBeNull();
    expect(parRepere({ root: arretee }, 'pastille-etat-non_aboutie')).not.toBeNull();
  });
});
